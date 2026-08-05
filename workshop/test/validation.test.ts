import { describe, expect, it } from 'vitest';
import { parseAliases, parseOpenerOrigin } from '../src/validation';

describe('parseAliases', () => {
  it('去重并清理别名', () => {
    expect(parseAliases('慕璇玑, 璇玑，慕璇玑')).toEqual(['慕璇玑', '璇玑']);
  });

  it('允许没有别名', () => {
    expect(parseAliases(' , ， ')).toEqual([]);
  });
});

describe('parseOpenerOrigin', () => {
  it('只保留 HTTP(S) origin', () => {
    expect(parseOpenerOrigin('http://127.0.0.1:8000/path')).toBe('http://127.0.0.1:8000');
    expect(() => parseOpenerOrigin('javascript:alert(1)')).toThrow('HTTP(S)');
  });
});
