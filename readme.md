# Twig Renderer

[![Greenkeeper badge](https://badges.greenkeeper.io/basaltinc/twig-renderer.svg)](https://greenkeeper.io/)

> Render templates using Twig PHP, via this Node JS renderer.

*Special thanks to [Salem Ghoweri](https://twitter.com/salem_ghoweri) for collaboration on this project!*

# How to Use

```bash
npm install --save @basalt/twig-renderer
```

```
const TwigRenderer = require('@basalt/twig-renderer');

const config = { 
  // see `./config.schema.js` for details
};

const twigRenderer = new TwigRenderer(config);

twigRenderer.render('@components/card.twig', { title: 'hi' }).then(results => {
  if (results.ok) {
    console.log(results.html);
  } else {
    console.log(results.message);
  }
});
```

Looking in tests folder can help.

# How to Develop

```bash
npm install
composer install
npm run setup
```
