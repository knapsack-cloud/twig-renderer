const path = require('path');
const qs = require('querystring');
const fp = require('find-free-port');
const fetch = require('node-fetch');
const sleep = require('sleep-promise');
const fs = require('fs-extra');
const execa = require('execa');
const Ajv = require('ajv');

const ajv = new Ajv({
  useDefaults: true,
});
const configSchema = require('../config.schema');

const validateSchemaAndAssignDefaults = ajv.compile(configSchema);

const serverStates = Object.freeze({
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY',
  STOPPING: 'STOPPING',
});

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 * @param {int} min - Lowest number
 * @param {int} max - Highest number
 * @returns {int} - A random number between the two
 * @todo Move to utils
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class TwigRenderer {
  constructor(userConfig) {
    this.serverState = serverStates.STOPPED;
    this.inProgressRequests = 0;
    this.config = Object.assign({}, userConfig);
    const isValid = validateSchemaAndAssignDefaults(this.config);
    if (!isValid) {
      // @todo Improve error message
      const msg = 'Error: config schema is not valid. Please check config.schema.json. Sorry for vague error.';
      console.error(msg);
      throw new Error(msg);
    }
    if (this.config.src.namespaces) {
      // @todo Validate that all namespace paths exist
    }
  }

  async init() {
    if (this.serverState === serverStates.STARTING) {
      // console.log('No need to re-init');
      return this.serverState;
    }

    if (this.config.verbose) {
      // console.log('Initializing PHP Server...');
    }
    this.serverState = serverStates.STARTING;

    // @todo improve method of selecting a port to try
    // Just because a port is available now, doesn't mean it wont be taken in 5ms :P
    const portAttempt = getRandomInt(10000, 65000);
    const [port] = await fp(portAttempt);
    this.phpServerPort = port;
    this.phpServerUrl = `http://127.0.0.1:${port}`;

    // @todo Pass config to PHP server a better way than writing JSON file, then reading in PHP
    const sharedConfigPath = path.join(__dirname, `shared-config--${port}.json`);
    await fs.writeFile(sharedConfigPath, JSON.stringify(this.config, null, '  '));

    this.phpServer = execa('php', [
      path.join(__dirname, 'server--async.php'),
      port,
      sharedConfigPath,
    ]);

    this.phpServer.on('close', async () => {
      // console.log(`Server ${this.phpServerPort} event: 'close'`);
      await fs.unlink(sharedConfigPath);
      this.serverState = serverStates.STOPPED;
    });

    this.phpServer.on('exit', () => {
      // console.log(`Server ${this.phpServerPort} event: 'exit'`);
      this.serverState = serverStates.STOPPING;
    });

    this.phpServer.on('disconnect', () => {
      // console.log(`Server ${this.phpServerPort} event: 'disconnect'`);
    });

    this.phpServer.on('error', () => {
      // console.log(`Server ${this.phpServerPort} event: 'error'`);
    });

    // @todo wrap this in config for seeing it besides `verbose` - too noisy
    this.phpServer.stdout.pipe(process.stdout);
    this.phpServer.stderr.pipe(process.stderr);

    if (this.config.verbose) {
      // console.log(`TwigRender js init complete. PHP server started on port ${port}`);
    }
    this.checkServerWhileStarting();
    return this.serverState;
  }

  closeServer() {
    this.phpServer.kill();
  }

  /**
   * Is PHP sever ready to render?
   * @returns {boolean} - is ready
   */
  async checkIfServerIsReady() {
    if (this.config.verbose) {
      // console.log(`Checking Server ${this.phpServerPort} was ${this.serverState}`);
    }
    try {
      const res = await fetch(this.phpServerUrl);
      const { ok } = res;
      if (ok) {
        this.serverState = serverStates.READY;
      }
      if (this.config.verbose) {
        // console.log(`Server ${this.phpServerPort} is ${this.serverState}`);
      }
      return ok;
    } catch (e) {
      return false;
    }
  }

  async checkServerWhileStarting() {
    while (this.serverState === serverStates.STARTING) {
      // console.log(`checkServerWhileStarting: ${this.serverState}`);
      await this.checkIfServerIsReady(); // eslint-disable-line no-await-in-loop
      await sleep(100); // eslint-disable-line no-await-in-loop
    }
    return this.serverState;
  }

  getServerState() {
    return this.serverState;
  }

  async render(templatePath, data = {}) {
    if (this.serverState === serverStates.STOPPED) {
      await this.init();
    }

    while (this.serverState !== serverStates.READY) {
      await sleep(250); // eslint-disable-line no-await-in-loop
    }

    while (this.inProgressRequests > this.config.maxConcurrency) {
      await sleep(250); // eslint-disable-line no-await-in-loop
    }

    if (this.config.verbose) {
      console.log(`About to render & server on port ${this.phpServerPort} is ${this.serverState}`);
    }

    this.inProgressRequests += 1;
    const attempts = 3;
    let attempt = 0;
    let results;

    while (attempt < attempts) {
      try {
        const requestUrl = `${this.phpServerUrl}?${qs.stringify({
          templatePath,
        })}`;

        const res = await fetch(requestUrl, { // eslint-disable-line no-await-in-loop
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const { status, headers, ok } = res;
        const contentType = headers.get('Content-Type');
        const warning = headers.get('Warning');

        if (contentType === 'application/json') {
          results = await res.json(); // eslint-disable-line no-await-in-loop
        } else {
          results = {
            ok,
            message: warning,
            html: await res.text(), // eslint-disable-line no-await-in-loop
          };
        }

        if (this.config.verbose) {
          // console.log('vvvvvvvvvvvvvvv');
          console.log(`Render request received: Ok: ${ok ? 'true' : 'false'}, Status Code: ${status}, templatePath: ${templatePath}.`);
          if (warning) {
            console.warn('Warning: ', warning);
          }
          // console.log(results);
          // console.log(`End: ${templatePath}`);
          // console.log('^^^^^^^^^^^^^^^^');
          // console.log();
        }
        break;
      } catch (e) {
        results = {
          ok: false,
          message: e.message,
        };
        attempt += 1;
      }
    }
    this.inProgressRequests -= 1;
    return results;
  }
}

module.exports = TwigRenderer;
