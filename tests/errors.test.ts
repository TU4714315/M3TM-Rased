import { describe, expect, it } from 'vitest';
import { friendlyError } from '../src/lib/errors';

describe('friendlyError', () => {
  it('explains invalid credentials without exposing the Firebase message', () => {
    expect(friendlyError(new Error('Firebase: Error (auth/invalid-credential).'))).toBe(
      'بيانات الدخول غير صحيحة.',
    );
  });

  it('turns internal auth failures into an actionable Arabic message', () => {
    expect(friendlyError(new Error('Firebase: Error (auth/internal-error).'))).toBe(
      'تعذر الاتصال بخدمة تسجيل الدخول. أعد المحاولة بعد تحديث الصفحة.',
    );
  });
});
