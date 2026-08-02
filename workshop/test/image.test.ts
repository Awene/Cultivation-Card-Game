import { describe, expect, it } from 'vitest';
import { inspectImage } from '../src/image';

describe('inspectImage', () => {
  it('拒绝 GIF', () => {
    const gif = new TextEncoder().encode('GIF89a');
    expect(() => inspectImage(gif, 'image/gif')).toThrow('不支持 GIF');
  });

  it('拒绝伪造 MIME', () => {
    const bytes = new Uint8Array(33);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    bytes.set([0, 0, 0, 13], 8);
    bytes.set(new TextEncoder().encode('IHDR'), 12);
    new DataView(bytes.buffer).setUint32(16, 1);
    new DataView(bytes.buffer).setUint32(20, 1);
    expect(() => inspectImage(bytes, 'image/jpeg')).toThrow('MIME');
  });
});

