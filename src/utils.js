import { join, relative } from 'path';
import fs from 'fs-extra';

/**
 * Formats Schema validation errors for using with `console.error`
 * @param {Array} errors - Error to format
 * @returns {string} - Errors to show
 */
export function formatSchemaErrors(errors) {
  if (errors.length === 0) return '';
  const msgs = errors.map((e) => {
    switch (e.keyword) {
      case 'type':
        return `Prop '${e.dataPath}' ${e.message}`;
      case 'additionalProperties':
        return `${e.message}: '${
          e.params.additionalProperty
        }' - add this to schema or remove`;
      case 'enum':
        return `Prop '${e.dataPath}' ${
          e.message
        }: ${e.params.allowedValues.join(', ')}`;
      default:
        return e.message;
    }
  }).map((error) => `🛑 ${error}`);
  return msgs.join('\n');
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 * @param {int} min - Lowest number
 * @param {int} max - Highest number
 * @returns {int} - A random number between the two
 */
export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Is this path a directory?
 * @param {string} thePath - Path to check
 * @returns {boolean} - is it a directory?
 */
export const isDir = (thePath) => fs.statSync(thePath).isDirectory();

function getAllSubFolders(dir) {
  return fs.readdirSync(dir).reduce((files, file) => {
    // if (file === 'node_modules') return [...files];
    const name = join(dir, file);
    return isDir(name) ? [...files, name, ...getAllSubFolders(name)] : [...files];
  }, []);
}

/**
 * Find all files inside a dir, recursively.
 * Synchronous b/c this is used in constructor, which cannot be async.
 * @param {string} dir - Dir path string.
 * @param {string} relativeFrom - path it should be relative from. If not, returns absolute paths.
 * @return {string[]} - Array with all directory names that are inside the directory.
 */
export function getAllFolders(dir, relativeFrom = '') {
  if (!isDir(dir)) {
    console.error(`This path is not a directory: ${dir}`);
  }
  const folders = [dir, ...getAllSubFolders(dir)];
  return relativeFrom ? folders.map((folder) => relative(relativeFrom, folder)) : folders;
}
