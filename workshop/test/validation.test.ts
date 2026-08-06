import { describe, expect, it } from 'vitest';
import { parseAliases, parseMatchTerms, parseOpenerOrigin } from '../src/validation';

describe('parseAliases', () => {
  it('去重并清理别名', () => {
    expect(parseAliases('慕璇玑, 璇玑，慕璇玑')).toEqual(['慕璇玑', '璇玑']);
  });

  it('允许没有别名', () => {
    expect(parseAliases(' , ， ')).toEqual([]);
  });
});

describe('parseMatchTerms', () => {
  it('去重并清理图包级抓取词', () => {
    expect(parseMatchTerms('霜花岛, 东土，霜花岛')).toEqual(['霜花岛', '东土']);
  });

  it('允许数组输入并拒绝过长抓取词', () => {
    expect(parseMatchTerms(['花海', '秘境'])).toEqual(['花海', '秘境']);
    expect(() => parseMatchTerms('x'.repeat(61))).toThrow('60');
  });
});

describe('parseOpenerOrigin', () => {
  it('只保留 HTTP(S) origin', () => {
    expect(parseOpenerOrigin('http://127.0.0.1:8000/path')).toBe('http://127.0.0.1:8000');
    expect(() => parseOpenerOrigin('javascript:alert(1)')).toThrow('HTTP(S)');
  });
});
