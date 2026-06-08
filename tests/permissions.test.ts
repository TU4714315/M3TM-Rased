import { describe, expect, it } from 'vitest';
import {
  canManageContent,
  canManageUsers,
  canRead,
  isBootstrapAdmin,
  normalizeEmail,
} from '../src/lib/permissions';

describe('permissions', () => {
  it('normalizes email addresses', () => {
    expect(normalizeEmail(' Admin@Example.COM ')).toBe('admin@example.com');
  });

  it('recognizes only configured bootstrap admins', () => {
    expect(isBootstrapAdmin('MOOOO M001@hotmail.com'.replace(' ', ''))).toBe(true);
    expect(isBootstrapAdmin('reader@example.com')).toBe(false);
  });

  it('enforces the three role levels', () => {
    expect(canManageUsers('admin')).toBe(true);
    expect(canManageUsers('manager')).toBe(false);
    expect(canManageContent('manager')).toBe(true);
    expect(canManageContent('user')).toBe(false);
    expect(canRead('user')).toBe(true);
    expect(canRead(null)).toBe(false);
  });
});
