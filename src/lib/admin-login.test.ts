import { describe, expect, it } from 'vitest';
import { isEmailOtp, resolveAdminAuthDestination } from '@/lib/admin-login';

describe('resolveAdminAuthDestination', () => {
  it('sends a completed login to MFA by default', () => {
    expect(resolveAdminAuthDestination(null)).toBe('/admin/mfa');
  });

  it('allows only local admin destinations', () => {
    expect(resolveAdminAuthDestination('/admin/weekly')).toBe('/admin/weekly');
    expect(resolveAdminAuthDestination('/admin')).toBe('/admin');
    expect(resolveAdminAuthDestination('//attacker.example/admin')).toBe('/admin/mfa');
    expect(resolveAdminAuthDestination('/admin-attacker')).toBe('/admin/mfa');
    expect(resolveAdminAuthDestination('/uk')).toBe('/admin/mfa');
  });
});

describe('isEmailOtp', () => {
  it('accepts exactly six decimal digits', () => {
    expect(isEmailOtp('123456')).toBe(true);
    expect(isEmailOtp('12345')).toBe(false);
    expect(isEmailOtp('1234567')).toBe(false);
    expect(isEmailOtp('12a456')).toBe(false);
  });
});
