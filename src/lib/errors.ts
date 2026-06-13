export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
  if (message.includes('permission-denied')) return 'لا تملك الصلاحية المطلوبة.';
  if (message.includes('invalid-credential')) return 'بيانات الدخول غير صحيحة.';
  if (message.includes('popup-closed')) return 'أغلقت نافذة Google قبل إكمال الدخول.';
  if (message.includes('unauthorized-domain')) {
    return 'الدومين غير مضاف إلى نطاقات Firebase المصرح بها.';
  }
  if (message.includes('internal-error')) {
    return 'تعذر الاتصال بخدمة تسجيل الدخول. أعد المحاولة بعد تحديث الصفحة.';
  }
  return message;
}
