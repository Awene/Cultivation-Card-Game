import type { ImageInspection } from './types';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function inspectPng(bytes: Uint8Array): ImageInspection | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  if (bytes.byteLength < 33 || ascii(bytes, 12, 4) !== 'IHDR') throw new Error('PNG 缺少有效 IHDR');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  let offset = 8;
  let containsPrivateMetadata = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    if (['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) containsPrivateMetadata = true;
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return { mimeType: 'image/png', extension: 'png', width, height, containsPrivateMetadata };
}

function inspectJpeg(bytes: Uint8Array): ImageInspection | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  let width = 0;
  let height = 0;
  let containsPrivateMetadata = false;
  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.byteLength) throw new Error('JPEG 分段长度无效');
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) containsPrivateMetadata = true;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) throw new Error('JPEG 尺寸分段无效');
      height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
    }
    offset += length;
  }
  if (!width || !height) throw new Error('无法读取 JPEG 尺寸');
  return { mimeType: 'image/jpeg', extension: 'jpg', width, height, containsPrivateMetadata };
}

function inspectWebp(bytes: Uint8Array): ImageInspection | null {
  if (bytes.byteLength < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  let offset = 12;
  let width = 0;
  let height = 0;
  let containsPrivateMetadata = false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 8 <= bytes.byteLength) {
    const type = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const data = offset + 8;
    if (type === 'EXIF' || type === 'XMP ') containsPrivateMetadata = true;
    if (type === 'VP8X' && size >= 10) {
      width = 1 + bytes[data + 4]! + (bytes[data + 5]! << 8) + (bytes[data + 6]! << 16);
      height = 1 + bytes[data + 7]! + (bytes[data + 8]! << 8) + (bytes[data + 9]! << 16);
    } else if (type === 'VP8 ' && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      width = (bytes[data + 6]! | (bytes[data + 7]! << 8)) & 0x3fff;
      height = (bytes[data + 8]! | (bytes[data + 9]! << 8)) & 0x3fff;
    } else if (type === 'VP8L' && size >= 5 && bytes[data] === 0x2f) {
      const bits = view.getUint32(data + 1, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
    offset = data + size + (size % 2);
  }
  if (!width || !height) throw new Error('无法读取 WebP 尺寸');
  return { mimeType: 'image/webp', extension: 'webp', width, height, containsPrivateMetadata };
}

export function inspectImage(bytes: Uint8Array, declaredMime?: string): ImageInspection {
  if (bytes.byteLength === 0) throw new Error('图片内容为空');
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('图片不能超过 6MB');
  const result = inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes);
  if (!result) throw new Error('只支持 JPEG、PNG、WebP，且不支持 GIF');
  if (declaredMime && declaredMime !== result.mimeType) throw new Error('图片 MIME 与实际内容不一致');
  if (result.width > MAX_IMAGE_EDGE || result.height > MAX_IMAGE_EDGE) {
    throw new Error(`图片宽高不能超过 ${MAX_IMAGE_EDGE}px`);
  }
  if (result.containsPrivateMetadata) throw new Error('图片仍包含 EXIF、文本或时间元数据，请在客户端重新编码后上传');
  return result;
}

