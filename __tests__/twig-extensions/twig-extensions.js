const path = require('path');

const TwigRenderer = require('../../src');

describe('Twig Extensions', () => {
  const twigRenderer = new TwigRenderer({
    src: {
      roots: [path.join(__dirname, 'src')],
    },
    alterTwigEnv: [{
      file: path.join(__dirname, 'alter-twig.php'),
      functions: ['addCustomExtension'],
    }],
  });

  test('Twig Extensions - Simple Function', async () => {
    const results = await twigRenderer.render('extension-test.twig');

    expect(results.ok).toEqual(true);
    expect(results).toMatchSnapshot();
  });

  afterAll(() => twigRenderer.closeServer());
});
