import type { Role } from '../types';

export const bootstrapAdminEmails = new Set([
  'moooom001@hotmail.com',
  'mohammed.e.z.m2@gmail.com',
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  return bootstrapAdminEmails.has(normalizeEmail(email ?? ''));
}

export function canManageContent(role: Role | null): boolean {
  return role === 'admin' || role === 'manager';
}

export function canManageUsers(role: Role | null): boolean {
  return role === 'admin';
}

export function canRead(role: Role | null): boolean {
  return role === 'admin' || role === 'manager' || role === 'user';
}
