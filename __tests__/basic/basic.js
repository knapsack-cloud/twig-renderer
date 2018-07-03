const path = require('path');
const fs = require('fs-extra');

const TwigRenderer = require('../../src');

describe('basic', () => {
  const twigRenderer = new TwigRenderer({
    src: {
      roots: [
        path.join(__dirname, 'src'),
        path.join(__dirname, 'src2'),
      ],
    },
    autoescape: false,
    verbose: true,
  });

  beforeAll(() => twigRenderer.init());

  test('basic1', async () => {
    await fs.emptyDir(path.join(__dirname, 'dist'));
    const results = await twigRenderer.render('hello-world.twig', {
      text: 'World',
    });

    if (results.ok) {
      await fs.writeFile(path.join(__dirname, 'dist', 'hello-world.html'), results.html);
    } else {
      console.error('Error: ', results.message);
    }

    expect(results.ok).toEqual(true);

    const expected = await fs.readFile(path.join(__dirname, 'expected', 'hello-world.html'), 'utf8');
    const actual = await fs.readFile(path.join(__dirname, 'dist', 'hello-world.html'), 'utf8');

    expect(actual.trim()).toEqual(expected.trim());
  });

  afterAll(() => twigRenderer.closeServer());
});
