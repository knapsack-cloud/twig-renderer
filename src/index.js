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

const sharedConfigPath = path.join(__dirname, 'shared-config.json');

class TwigRenderer {
  constructor(userConfig) {
    this.settings = {};
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
    // @todo Pass config to PHP server a better way than writing JSON file, then reading in PHP
    await fs.writeFile(sharedConfigPath, JSON.stringify(this.config, null, '  '));
    const [port] = await fp(8000, 9000);
    this.settings.phpServerUrl = `127.0.0.1:${port}`;

    this.phpServer = execa('php', [
      '-S',
      this.settings.phpServerUrl,
      path.join(__dirname, 'server.php'),
    ]);

    this.phpServer.stdout.pipe(process.stdout);
    this.phpServer.stderr.pipe(process.stderr);

    if (this.config.verbose) {
      console.log('TwigRender js init');
    }

    // @todo detect when PHP server is ready to go; in meantime, we'll just pause for a moment
    await sleep(1000);
    return true;
  }

  closeServer() {
    this.phpServer.kill();
  }

  async render(templatePath, data = {}) {
    try {
      const requestUrl = `http://${this.settings.phpServerUrl}?${qs.stringify({
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
      const warning = headers.get('Warning');
      const results = await res.json();

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
