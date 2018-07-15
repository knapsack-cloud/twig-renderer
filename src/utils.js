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
  }).map(error => `🛑 ${error}`);
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
