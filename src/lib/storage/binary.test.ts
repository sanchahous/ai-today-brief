import { describe, expect, it } from 'vitest';
import { storageBlob } from './binary';

describe('storageBlob', () => {
  it('preserves non-UTF-8 binary bytes for Storage uploads', async () => {
    const jpegPrefix = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x80, 0xfe]);
    const blob = storageBlob(jpegPrefix, 'image/jpeg');

    expect(blob.type).toBe('image/jpeg');
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(jpegPrefix);
  });
});
