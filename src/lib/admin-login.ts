export function resolveAdminAuthDestination(next: string | null): string {
  if (next === '/admin' || next?.startsWith('/admin/')) return next;
  return '/admin/mfa';
}

export function isEmailOtp(value: string): boolean {
  return /^\d{6}$/.test(value);
}
