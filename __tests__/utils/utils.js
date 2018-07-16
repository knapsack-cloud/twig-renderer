import { join } from 'path';
import { getAllFolders } from '../../src/utils';

describe('utils', () => {
  test('getAllFolders', () => {
    const allFolders = getAllFolders(join(__dirname, 'src'), __dirname);
    expect(allFolders).toEqual([
      'src',
      'src/a',
      'src/a/b',
      'src/a/b/c',
      'src/a/b2',
      'src/a/b2/c2',
      'src/a2',
      'src/a2/b',
      'src/a2/b/c',
      'src/a2/b2',
      'src/a2/b2/c2',
    ]);
  });
});
