const fetch = require('node-fetch');

const TwigRenderer = require('../src');

describe('Server Codes', () => {
  const twigRenderer = new TwigRenderer({
    src: {
      roots: [__dirname],
    },
    verbose: true,
  });

  beforeAll(() => twigRenderer.init());

  test('OK', async () => {
    const res = await fetch(twigRenderer.phpServerUrl);
    const { ok } = res;

    expect(ok).toEqual(true);
  });

  afterAll(() => twigRenderer.closeServer());
});
