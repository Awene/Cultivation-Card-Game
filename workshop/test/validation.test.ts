import { describe, expect, it } from 'vitest';
import { parseKeywords, parseOpenerOrigin } from '../src/validation';

describe('parseKeywords', () => {
  it('去重并清理关键词', () => {
    expect(parseKeywords('慕璇玑, 月夜，慕璇玑')).toEqual(['慕璇玑', '月夜']);
  });

  it('拒绝空关键词', () => {
    expect(() => parseKeywords(' , ， ')).toThrow('关键词数量');
  });
});

describe('parseOpenerOrigin', () => {
  it('只保留 HTTP(S) origin', () => {
    expect(parseOpenerOrigin('http://127.0.0.1:8000/path')).toBe('http://127.0.0.1:8000');
    expect(() => parseOpenerOrigin('javascript:alert(1)')).toThrow('HTTP(S)');
  });
});

