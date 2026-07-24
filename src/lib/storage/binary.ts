/**
 * Supabase Storage uploads must receive a web binary body in server runtimes.
 * Passing a Node Buffer directly through the production fetch adapter can coerce
 * non-UTF-8 bytes into replacement characters, corrupting rendered media.
 */
export function storageBlob(bytes: Uint8Array, contentType: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: contentType });
}
