# 🚀 دليل النشر والنشر - Deployment Guide

## النشر على GitHub Pages

### الخطوة 1: تفعيل GitHub Pages ⚙️

```
1. اذهب إلى Settings في المستودع
2. اختر Pages من القائمة الجانبية
3. في "Source" اختر: main branch
4. اضغط Save
```

**النتيجة**: سيظهر رابط أزرق مثل:
```
https://tu4714315.github.io/M3TM-Rased/
```

---

## النشر التلقائي مع GitHub Actions

### كيفية العمل ✅

عند كل `git push`:
1. **GitHub Actions** يتحقق من الملفات
2. **ينسخ** الملفات إلى GitHub Pages
3. **ينشر** الموقع تلقائياً خلال دقيقة

### الملف المسؤول:

```
.github/workflows/deploy.yml
```

### النشر يتضمن:
- ✅ جميع الملفات من المجلد الرئيسي
- ✅ index.html بشكل مباشر
- ✅ جميع الموارد المطلوبة

---

## إضافة دومين مخصص

### الخيار 1: دومين مجاني من Freenom (.ml) 🎉

#### الخطوة 1: تسجيل الدومين

```
1. اذهب إلى: https://www.freenom.com
2. سجل حساب جديد (بريد + كلمة مرور)
3. ابحث عن النطاق الذي تريده
4. أضف للسلة
5. اختر مدة مجانية (سنة واحدة)
6. أكمل الدفع (مجاني)
7. احصل على دومين مثل: yourdomain.ml
```

#### الخطوة 2: ربط مع Cloudflare

```
1. اذهب إلى: https://www.cloudflare.com
2. سجل حساب جديد
3. أضف الموقع (Add a Site)
4. أدخل دومينك (yourdomain.ml)
5. اختر الخطة المجانية
6. انسخ Nameservers من Cloudflare
```

#### الخطوة 3: تحديث Nameservers في Freenom

```
1. اذهب إلى Freenom → My Domains
2. اختر دومينك
3. اضغط Manage Domain
4. اختر Management Tools → Nameservers
5. اختر "Use custom nameservers"
6. أدخل Nameservers من Cloudflare:
   - ns1.cloudflare.com
   - ns2.cloudflare.com
   - ns3.cloudflare.com
   - ns4.cloudflare.com
7. احفظ التغييرات
```

#### الخطوة 4: إضافة CNAME في Cloudflare

```
1. اذهب إلى Cloudflare → DNS
2. اضغط "Add record"
3. اختر Type: CNAME
4. في Name: @ (أو yourdomain.ml)
5. في Content: tu4714315.github.io
6. TTL: Auto
7. Proxy Status: Proxied (الزرقاء)
8. اضغط Save
```

#### الخطوة 5: تفعيل Custom Domain في GitHub

```
1. اذهب إلى Settings → Pages
2. في "Custom domain" أدخل: yourdomain.ml
3. اضغط Save
4. انتظر 5-10 دقائق
5. سيظهر ✅ إذا كان كل شيء صحيح
```

**النتيجة النهائية**: 🎉
```
https://yourdomain.ml
```

---

### الخيار 2: دومين مدفوع

#### الخطوات:
```
1. اشترِ دومين من Namecheap, GoDaddy, إلخ
2. اذهب إلى إعدادات الدومين
3. أضف CNAME record:
   - Name: @ (أو www)
   - Value: tu4714315.github.io
4. احفظ التغييرات
5. الانتظار 24-48 ساعة لانتشار التغييرات
```

---

## فحص الحالة

### التحقق من النشر:

```bash
# فحص الحالة الحالية
1. اذهب إلى https://tu4714315.github.io/M3TM-Rased/
   أو إلى دومينك المخصص

2. يجب أن ترى الواجهة تعمل بشكل كامل

3. جرب تسجيل الدخول:
   - PIN: 123987 (مسؤول)
   - PIN: 1234 (مستخدم عام)
```

### استكشاف الأخطاء:

| المشكلة | الحل |
|--------|------|
| **الموقع لا يظهر** | انتظر 5 دقائق، ثم حاول تحديث الصفحة |
| **صفحة 404** | تحقق من Settings → Pages |
| **الدومين لا يعمل** | تحقق من DNS في Cloudflare |
| **محتوى قديم** | امسح Cache المتصفح (Ctrl+Shift+Del) |

---

## البيانات والنسخ الاحتياطية 💾

### أين تُحفظ البيانات؟

```javascript
// في متصفح المستخدم فقط
localStorage.getItem("m3tm_rased_data_v3")
localStorage.getItem("m3tm_theme")
```

### عمل نسخة احتياطية يدويّة:

**من خلال الواجهة:**
```
1. افتح أدوات المطور (F12)
2. اذهب إلى Console
3. اكتب:
   copy(localStorage.getItem("m3tm_rased_data_v3"))
4. الصق في ملف نصي
5. احفظه بأمان
```

### استعادة البيانات:

```javascript
// في Console:
localStorage.setItem("m3tm_rased_data_v3", 'DATA_HERE')
location.reload()
```

---

## الأداء والتحسينات 🚀

### حجم الملف:
- **index.html**: ~37 KB (محسّن)
- **وقت التحميل**: < 1 ثانية
- **استهلاك الذاكرة**: < 5 MB

### تحسينات التحميل:
- ✅ Single-file deployment (ملف واحد فقط)
- ✅ Minified CSS و JavaScript
- ✅ No external dependencies
- ✅ Cached fonts
- ✅ Optimized images

---

## التحديثات المستقبلية

### المخطط الزمني:
```
v4.0 (الآن) ✅
├── Dark Mode
├── البحث والفلترة
└── تحسينات الواجهة

v5.0 (القادم) ⏳
├── Firestore Integration
├── Cloud Functions
└── Export/Import

v6.0 (لاحقاً) 📅
├── Mobile App
├── Telegram Bot
└── REST API
```

---

## أسئلة شائعة ❓

### س: هل يمكن نقل الدومين لاحقاً؟
**ج**: نعم! يمكنك تغيير الـ DNS في أي وقت.

### س: هل البيانات آمنة؟
**ج**: البيانات محلية 100% - لا تغادر المتصفح.

### س: هل يمكن استخدام دومين مختلف؟
**ج**: نعم! أي دومين + تحديث CNAME.

### س: هل أحتاج إلى خادم؟
**ج**: لا! GitHub Pages يوفر الاستضافة مجاناً.

### س: كيف أتحديث الموقع؟
**ج**: اضغط git push وسيتحدث تلقائياً.

---

## الدعم والمساعدة 💬

إذا واجهت أي مشكلة:
1. 📖 اقرأ هذا الدليل
2. 🔍 ابحث في GitHub Issues
3. 💬 افتح Discussion
4. 🐛 أبلغ عن الخطأ

---

**النشر الآمن والموثوق! 🎉**

آخر تحديث: 2026-05-17
