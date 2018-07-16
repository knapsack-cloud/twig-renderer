const path = require('path');
const fs = require('fs-extra');

const TwigRenderer = require('../../');

describe('Namespaces', () => {
  const twigRenderer = new TwigRenderer({
    relativeFrom: __dirname,
    src: {
      roots: ['src'],
      namespaces: [
        {
          id: 'atoms',
          paths: ['atoms'],
        },
        {
          id: 'molecules',
          recursive: true,
          paths: [path.join(__dirname, 'molecules')],
        },
      ],
    },
    autoescape: false,
    verbose: true,
  });

  test('Namespaces1', async () => {
    await fs.emptyDir(path.join(__dirname, 'dist'));
    const results = await twigRenderer.render('@molecules/water.twig');

    if (results.ok) {
      await fs.writeFile(path.join(__dirname, 'dist', 'result.html'), results.html);
    } else {
      console.error('Error: ', results.message);
    }

    expect(results.ok).toEqual(true);

    const expected = await fs.readFile(path.join(__dirname, 'expected', 'result.html'), 'utf8');
    const actual = await fs.readFile(path.join(__dirname, 'dist', 'result.html'), 'utf8');

    expect(expected.trim()).toEqual(actual.trim());
  });
});
