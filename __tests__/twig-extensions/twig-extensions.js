const TwigRenderer = require('../../');

describe('Twig Extensions', () => {
  const twigRenderer = new TwigRenderer({
    relativeFrom: __dirname,
    src: {
      roots: ['src'],
    },
    alterTwigEnv: [{
      file: 'alter-twig.php',
      functions: ['addCustomExtension'],
    }],
  });

  test('Twig Extensions - Simple Function', async () => {
    const results = await twigRenderer.render('extension-test.twig');

    expect(results.ok).toEqual(true);
    expect(results).toMatchSnapshot();
  });
});
