import path from 'path';
import qs from 'querystring';
import fp from 'find-free-port';
import fetch from 'node-fetch';
import sleep from 'sleep-promise';
import fs from 'fs-extra';
import execa from 'execa';
import Ajv from 'ajv';
import { getRandomInt, formatSchemaErrors, getAllFolders } from './utils';
import configSchema from '../config.schema';

const ajv = new Ajv({
  useDefaults: true,
});

const validateSchemaAndAssignDefaults = ajv.compile(configSchema);

const serverStates = Object.freeze({
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY',
  STOPPING: 'STOPPING',
});

class TwigRenderer {
  /**
   * @param {TwigRendererConfig} userConfig - User config
   */
  constructor(userConfig) {
    try {
      execa.shellSync('php --version');
    } catch (err) {
      console.error('Error: php cli required. ', err.message);
      process.exit(1);
    }

    this.serverState = serverStates.STOPPED;
    this.inProgressRequests = 0;
    this.totalRequests = 0;
    this.completedRequests = 0;
    this.config = Object.assign({}, userConfig);
    const isValid = validateSchemaAndAssignDefaults(this.config);
    if (!isValid) {
      const { errors } = validateSchemaAndAssignDefaults;
      const msgs = ['Error: Please check config passed into TwigRenderer.', formatSchemaErrors(errors)].join('\n');
      console.error(msgs);
      if (process.env.NODE_ENV === 'testing') {
        process.exitCode = 1;
      } else {
        process.exit(1);
      }
      throw new Error(msgs);
    }

    if (this.config.relativeFrom) {
      if (!fs.existsSync(this.config.relativeFrom)) {
        const msg = `Uh oh, that file path does not exist: ${this.config.relativeFrom}`;
        console.error(msg);
        process.exitCode = 1;
        throw new Error(msg);
      }
      this.config.relativeFrom = path.resolve(process.cwd(), this.config.relativeFrom);
    } else {
      this.config.relativeFrom = process.cwd();
    }

    if (this.config.alterTwigEnv) {
      this.config.alterTwigEnv = this.config.alterTwigEnv.map((item) => {
        const isAbsolute = path.isAbsolute(item.file);
        return {
          file: isAbsolute ? item.file : path.resolve(this.config.relativeFrom, item.file),
          functions: item.functions,
        };
      });
    }

    this.config = TwigRenderer.processPaths(this.config);
    // Writing this so `server--sync.php` can use
    fs.writeFileSync(path.join(__dirname, 'shared-config.json'), JSON.stringify(this.config, null, '  '));
  }

  /**
   * @param {object} config - this.config
   * @returns {object} - config with checked and modified paths
   */
  static processPaths(config) {
    function checkPaths(paths, { relativeFrom, recursive = false }) {
      const thePaths = paths.map((thePath) => {
        const fullPath = path.resolve(relativeFrom, thePath);
        const relPath = path.relative(relativeFrom, fullPath);
        if (!fs.existsSync(fullPath)) {
          const msg = `This file path does not exist, but was used in config: ${thePath}`;
          console.error(msg);
          process.exitCode = 1;
          throw new Error(msg);
        }
        return recursive ? getAllFolders(fullPath, relativeFrom) : relPath;
      });
      // Flattening arrays in case `recursive` was set
      return [].concat(...thePaths);
    }

    const processedConfig = Object.assign({}, config);
    const { relativeFrom } = processedConfig;
    let { roots, namespaces } = processedConfig.src;

    roots = checkPaths(roots, { relativeFrom });
    if (namespaces) {
      namespaces = namespaces.map(namespace => ({
        id: namespace.id,
        paths: checkPaths(namespace.paths, { relativeFrom, recursive: namespace.recursive }),
      }));
    }

    processedConfig.relativeFrom = relativeFrom;
    processedConfig.src.roots = roots;
    if (namespaces) {
      processedConfig.src.namespaces = namespaces;
    }

    return processedConfig;
  }

  /**
   * Convert Legacy Namespaces Config
   * The old format was an object with the keys being the namespace id and the value the config;
   * the new format is an array of objects that are the exact same config,
   * but the namespace id is the `id` property in the object.
   * @param {object} namespaces - Namespaces config
   * @return {object[]} - Format needed by `config.src.namespaces` (see `config.schema.json`)
   */
  static convertLegacyNamespacesConfig(namespaces) {
    return Object.keys(namespaces).map((id) => {
      const value = namespaces[id];
      return Object.assign({ id }, value);
    });
  }

  async init() {
    if (this.serverState === serverStates.STARTING) {
      // console.log('No need to re-init');
      return this.serverState;
    }

    if (this.serverState === serverStates.STOPPING) {
      // console.log('Server currently stopping -- trying to restart.');
      this.serverState = serverStates.READY;
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

    const params = [
      path.join(__dirname, 'server--async.php'),
      port,
      sharedConfigPath,
    ];

    this.phpServer = execa('php', params, {
      cleanup: true,
      detached: false,
    });

    this.phpServer.on('close', async () => {
      // console.log(`Server ${this.phpServerPort} event: 'close'`);
      this.serverState = serverStates.STOPPING;
    });

    this.phpServer.on('exit', async () => {
      // console.log(`Server ${this.phpServerPort} event: 'exit'`);
      await fs.unlink(sharedConfigPath);
      this.serverState = serverStates.STOPPED;
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
    await this.checkServerWhileStarting();
    return this.serverState;
  }

  stop() {
    // console.log(`stopping server with port ${this.phpServerPort}`);
    this.serverState = serverStates.STOPPED;
    this.phpServer.kill();
    this.phpServer.removeAllListeners();
  }

  async closeServer() {
    // console.log('checking if we can stop the server...');
    if (this.config.keepAlive === false) {
      if (this.completedRequests === this.totalRequests
        && this.inProgressRequests === 0
        && (
          this.serverState !== serverStates.STOPPING
          || this.serverState !== serverStates.STOPPED
        )
      ) {
        this.stop();
      } else {
        setTimeout(() => {
          if (this.completedRequests === this.totalRequests && this.inProgressRequests === 0) {
            this.stop();
          }
        }, 300);
      }
    }
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

  /**
   * Render Twig Template
   * @param {string} template - Template path
   * @param {object} data - Data to pass to template
   * @returns {Promise<{ok: boolean, html: string, message: string}>} - Render results
   */
  async render(template, data = {}) {
    const result = await this.request('renderFile', {
      template,
      data,
    });
    this.closeServer();
    return result;
  }

  /**
   * Render Twig String
   * @param {string} template - inlined Twig template
   * @param {object} data - Data to pass to template
   * @returns {Promise<{ok: boolean, html: string, message: string}>}  - Render results
   */
  async renderString(template, data = {}) {
    const result = await this.request('renderString', {
      template,
      data,
    });
    this.closeServer();
    return result;
  }

  async getMeta() {
    return this.request('meta');
  }

  async request(type, body = {}) {
    this.totalRequests += 1;
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

    const attempts = 3;
    let attempt = 0;
    let results;

    while (attempt < attempts) {
      try {
        this.inProgressRequests += 1;
        const requestUrl = `${this.phpServerUrl}?${qs.stringify({
          type,
        })}`;

        // @todo Fail if no response after X seconds
        const res = await fetch(requestUrl, { // eslint-disable-line no-await-in-loop
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
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
        this.inProgressRequests -= 1;
        this.completedRequests += 1;

        if (this.config.verbose) {
          // console.log('vvvvvvvvvvvvvvv');
          console.log(`Render request received: Ok: ${ok ? 'true' : 'false'}, Status Code: ${status}, type: ${type}. ${body.template ? `template: ${body.template}` : ''}`);
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
        this.inProgressRequests -= 1;
      }
    }
    return results;
  }
}

export default TwigRenderer;
