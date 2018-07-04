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
const configSchema = require('./config.schema');

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
 * @param min {int}
 * @param max {int}
 * @returns {int}
 * @todo Move to utils
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class TwigRenderer {
  constructor(userConfig) {
    this.serverState = serverStates.STOPPED;
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
    this.serverState = serverStates.STARTING;

    // @todo improve method of selecting a port to try
    // Just because a port is available now, doesn't mean it wont be taken in 5ms :P
    const portAttempt = getRandomInt(10000, 65000);
    const [port] = await fp(portAttempt);
    this.phpServerPort = port;
    this.phpServerUrl = `127.0.0.1:${port}`;

    const sharedConfigPath = path.join(__dirname, `shared-config--${port}.json`);
    await fs.writeFile(sharedConfigPath, JSON.stringify(this.config, null, '  '));

    // @todo Pass config to PHP server a better way than writing JSON file, then reading in PHP

    this.phpServer = execa('php', [
      '-S',
      this.phpServerUrl,
      path.join(__dirname, 'server.php'),
    ]);

    // @todo wrap this in config for seeing it besides `verbose` - too noisy
    this.phpServer.stdout.pipe(process.stdout);
    this.phpServer.stderr.pipe(process.stderr);

    // @todo detect when PHP server is ready to go; in meantime, we'll just pause for a moment
    await sleep(3000);
    this.serverState = serverStates.READY;

    if (this.config.verbose) {
      console.log(`TwigRender js init complete. PHP server started on port ${port}`);
    }
    return this.serverState;
  }

  closeServer() {
    this.phpServer.kill();
  }

  /**
  * Is PHP sever ready to render?
  * @returns {boolean}
  */
  isReady() {
    return this.serverState === serverStates.READY;
  }

  getServerState() {
    return this.serverState;
  }

  async render(templatePath, data = {}) {
    if (this.config.verbose) {
      console.log(`About to render & server on port ${this.phpServerPort} is ${this.serverState}`);
    }

    try {
      const requestUrl = `http://${this.phpServerUrl}?${qs.stringify({
        templatePath,
      })}`;

      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const { status, headers, ok } = res;
      const contentType = headers.get('Content-Type');
      const warning = headers.get('Warning');
      let results;
      if (contentType === 'application/json') {
        results = await res.json();
      } else {
        results = {
          ok,
          message: warning,
          html: await res.text(),
        };
      }

      if (this.config.verbose) {
        console.log('vvvvvvvvvvvvvvv');
        console.log(`Render request received: Ok: ${ok ? 'yes' : 'no'}, Status Code: ${status}.`);
        console.log(templatePath);
        if (warning) {
          console.warn('Warning: ', warning);
        }
        console.log(results);
        console.log(`End: ${templatePath}`);
        console.log('^^^^^^^^^^^^^^^^');
        console.log();
      }
      return results;
    } catch (e) {
      return {
        ok: false,
        message: e.message,
      };
    }
  }
}

module.exports = TwigRenderer;
