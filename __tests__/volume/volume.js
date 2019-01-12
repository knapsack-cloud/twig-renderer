const path = require('path');
const fs = require('fs-extra');

const TwigRenderer = require('../../');

describe('volume', () => {
  const twigRenderer = new TwigRenderer({
    relativeFrom: __dirname,
    src: {
      roots: [
        path.join(__dirname, 'src'),
      ],
    },
    autoescape: false,
    verbose: false,
  });

  test('volume - 1000 basic renders', async () => {
    await fs.emptyDir(path.join(__dirname, 'dist'));

    const renders = [];

    for (let i = 0; i < 1000; i++) {
      renders.push(new Promise(async (resolve) => {
        const result = await twigRenderer.render(`item-${i}.twig`);

        if (result.ok) {
          await fs.writeFile(path.join(__dirname, 'dist', `item-${i}.html`), result.html);
        } else {
          // console.error('Error: ', result.message);
          // reject(result);
        }
        resolve(result);
      }));
    }

    const results = await Promise.all(renders);

    expect(results).toMatchSnapshot();
    expect(results.filter(result => !result.ok)).toEqual([]);
  }, 120000);
});
