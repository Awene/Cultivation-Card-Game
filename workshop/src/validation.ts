import type { ImageRating, PackCategory } from './types';

export class InputError extends Error {
  readonly status = 400;
}

export function requireString(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new InputError(`${label}必须是文本`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new InputError(`${label}长度必须为 ${min}～${max}`);
  return result;
}

export function optionalString(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new InputError(`${label}必须是文本`);
  const result = value.trim();
  if (result.length > max) throw new InputError(`${label}不能超过 ${max} 字`);
  return result;
}

export function parseCategory(value: unknown): PackCategory {
  if (value !== '风景' && value !== '人物' && value !== '其他') throw new InputError('图包类别无效');
  return value;
}

export function parseRating(value: unknown): ImageRating {
  if (value !== 'sfw' && value !== 'nsfw') throw new InputError('图片类别必须为 sfw 或 nsfw');
  return value;
}

export function parseAliases(value: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[，,\n]/u) : [];
  const result = [...new Set(source.map(item => String(item).normalize('NFKC').trim()).filter(Boolean))];
  if (result.length > 30) throw new InputError('别名数量不能超过 30 个');
  if (result.some(item => item.length > 30)) throw new InputError('单个别名不能超过 30 字');
  return result;
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('请求体必须是对象');
  return value as Record<string, unknown>;
}

export function parseOpenerOrigin(value: string | null): string {
  if (!value) throw new InputError('缺少 opener_origin');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InputError('opener_origin 无效');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new InputError('opener_origin 只允许 HTTP(S)');
  return url.origin;
}
