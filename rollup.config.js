import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import clear from 'rollup-plugin-clear';
import filesize from 'rollup-plugin-filesize';
import resolve from 'rollup-plugin-node-resolve';
import json from 'rollup-plugin-json';
import copy from 'rollup-plugin-copy-assets';

const pkg = require('./package.json');

const config = {
  input: './src/index.js',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    copy({
      assets: [
        './src/server--async.php',
        './src/server--sync.php',
        './src/TwigRenderer.php',
      ],
    }),
    resolve({
      extensions: ['.mjs', '.js', '.json'],
      only: [/config\.schema/],
    }),
    commonjs(),
    json(),
    babel({
      exclude: 'node_modules/**',
    }),
    filesize(),
    clear({
      targets: ['./dist'],
    }),
  ],
  external: [
    'path',
    'querystring',
    ...Object.keys(pkg.dependencies),
  ],
};

export default config;
