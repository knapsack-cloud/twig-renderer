const TwigRenderer = require('../../');

describe('strings', () => {
  const twigRenderer = new TwigRenderer({
    relativeFrom: __dirname,
    src: {
      roots: [
        'src',
      ],
    },
    verbose: true,
    keepAlive: false,
  });

  test('strings1', async () => {
    const results = await twigRenderer.renderString('Hello {{ text }}', {
      text: 'World',
    });

    expect(results.html).toEqual('Hello World');
  });

  test('strings2', async () => {
    const results = await twigRenderer.renderString('Hello {{ text }} {% include "hi.twig" %}', {
      text: 'World',
    });

    expect(results.html).toEqual('Hello World <h1>Hi World!</h1>');
  });
});
