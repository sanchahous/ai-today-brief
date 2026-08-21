export const MAX_CANCEL_PACKAGES = 20;

const PACKAGE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readPackageId(value: FormDataEntryValue): string {
  if (typeof value !== 'string') {
    throw new Error('A package id is invalid.');
  }
  const id = value.trim();
  if (!PACKAGE_UUID.test(id)) {
    throw new Error('A package id is invalid.');
  }
  return id;
}

/**
 * Queue bulk-cancel posts `package_id`; the package editor posts a single `id`.
 */
export function parseCancelPackageIds(formData: FormData): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of [...formData.getAll('id'), ...formData.getAll('package_id')]) {
    const id = readPackageId(value);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (unique.length === 0) {
    throw new Error('Select at least one package.');
  }
  if (unique.length > MAX_CANCEL_PACKAGES) {
    throw new Error(`Cannot cancel more than ${MAX_CANCEL_PACKAGES} packages at once.`);
  }
  return unique;
}
