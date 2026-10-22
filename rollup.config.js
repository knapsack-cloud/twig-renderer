import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';

const pkg = require('./package.json');

const config = {
  input: './src/twig-renderer.js',
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
    resolve({
      extensions: ['.mjs', '.js', '.json'],
      resolveOnly: [/config\.schema/],
    }),
    commonjs(),
    json(),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
    }),
  ],
  external: [
    'path',
    'querystring',
    ...Object.keys(pkg.dependencies),
  ],
};

export default config;
