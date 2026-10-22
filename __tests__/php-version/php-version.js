import { isSupportedPhpVersion } from '../../src/utils';

jest.mock('execa', () => {
  const execa = jest.fn();
  execa.sync = jest.fn();
  return execa;
});

describe('isSupportedPhpVersion', () => {
  test.each([
    // [PHP_VERSION_ID, version, expected]
    [80134, '8.1.34', false],
    [80234, '8.2.34', false],
    [80235, '8.2.35', true],
    [80299, '8.2.99', true],
    [80335, '8.3.35', false],
    [80336, '8.3.36', true],
    [80426, '8.4.26', false],
    [80427, '8.4.27', true],
    [80511, '8.5.11', false],
    [80512, '8.5.12', true],
    [80600, '8.6.0', true],
    [90000, '9.0.0', true],
    [70433, '7.4.33', false],
  ])('%i (%s) -> %s', (phpVersionId, version, expected) => {
    expect(isSupportedPhpVersion(phpVersionId)).toBe(expected);
  });
});

describe('TwigRenderer PHP version gate', () => {
  let exitSpy;
  let errorSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('exits with status 1 on an unpatched PHP', () => {
    // eslint-disable-next-line global-require
    const execa = require('execa');
    execa.sync.mockReturnValue({ stdout: '80335' });
    // eslint-disable-next-line global-require
    const TwigRenderer = require('../..');

    expect(() => new TwigRenderer({})).toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found PHP_VERSION_ID 80335'),
    );
  });
});
