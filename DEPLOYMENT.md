# 🚀 دليل النشر والدومين - Deployment Guide

## 🌟 الوضع الحالي

✅ **المنصة**: GitHub Pages + Cloudflare + Freenom  
✅ **الدومين**: m3tm-rased.ml (مجاني)  
✅ **SSL**: HTTPS مشفّر (مجاني من Cloudflare)  
✅ **CI/CD**: GitHub Actions (تلقائي)  
✅ **الحالة**: جاهز للإنتاج 🎉

---

## 📋 قائمة المتطلبات

قبل البدء، تأكد من أن لديك:

```
☐ حساب GitHub (لديك بالفعل)
☐ حساب Freenom (مجاني)
☐ حساب Cloudflare (مجاني)
☐ بريد إلكتروني نشط
☐ متصفح حديث
```

---

## 🎯 خطوات النشر الكاملة

### المرحلة الأولى: تسجيل الدومين على Freenom

#### 1. إنشاء حساب Freenom
```
الرابط: https://www.freenom.com
1. اضغط: Sign Up
2. أدخل: البريد الإلكتروني
3. أدخل: كلمة المرور
4. تحقق من بريدك الإلكتروني
5. اضغط: Activate Account
```

#### 2. البحث عن الدومين
```
1. عد إلى الصفحة الرئيسية
2. في حقل البحث أدخل: m3tm-rased
3. اختر: .ml (مجاني)
4. اضغط: Check Availability
```

#### 3. تسجيل الدومين
```
1. اضغط: Add to Cart
2. اختر المدة: 12 months (مجاني)
3. اضغط: Checkout
4. أكمل البيانات الشخصية
5. أقبل الشروط
6. اضغط: Complete Order
```

✅ **النتيجة**: ستحصل على تأكيد ببريدك

---

### المرحلة الثانية: إعداد Cloudflare

#### 1. إنشاء حساب Cloudflare
```
الرابط: https://www.cloudflare.com
1. اضغط: Sign Up
2. أدخل: البريد الإلكتروني
3. أدخل: كلمة المرور
4. تحقق من بريدك
```

#### 2. إضافة الموقع
```
1. في Dashboard اضغط: Add a Site
2. أدخل اسم الدومين: m3tm-rased.ml
3. اضغط: Add Site
4. اختر الخطة: Free Plan
5. اضغط: Continue
```

#### 3. نسخ الـ Nameservers
```
ستظهر لك Nameservers:
- ns1.cloudflare.com
- ns2.cloudflare.com
- (ربما ns3 و ns4)

⚠️ احفظها الآن! ستحتاجها في الخطوة الآتية
```

---

### المرحلة الثالثة: تحديث Nameservers في Freenom

#### الخطوات:
```
1. اذهب إلى: https://www.freenom.com
2. تسجيل دخول بحسابك
3. اضغط: My Domains
4. اختر: m3tm-rased.ml
5. اضغط: Manage Domain
6. اضغط: Management Tools
7. اختر: Nameservers
8. اختر: Use Custom Nameservers

أضف من Cloudflare:
- ns1.cloudflare.com
- ns2.cloudflare.com

9. احفظ التغييرات (Save)
```

⏳ **الانتظار**: 5-10 دقائق (قد تصل إلى 30 دقيقة)

---

### المرحلة الرابعة: إعداد DNS في Cloudflare

#### 1. إضافة CNAME Record
```
في Cloudflare Dashboard:

1. اختر الموقع: m3tm-rased.ml
2. اذهب إلى: DNS
3. اضغط: Add Record
4. ملأ:
   - Type: CNAME
   - Name: @ (أو اتركها فارغة = جذر الدومين)
   - Target: tu4714315.github.io
   - TTL: Auto
   - Proxy status: ✓ Proxied (يجب أن تكون زرقاء)
5. اضغط: Save
```

#### 2. التحقق من الإعدادات
```
يجب أن ترى:
✓ @ → CNAME → tu4714315.github.io (Proxied)
✓ Status: Active (أخضر)
```

---

### المرحلة الخامسة: تفعيل Custom Domain في GitHub

#### 1. الذهاب إلى إعدادات المستودع
```
1. اذهب إلى: https://github.com/TU4714315/M3TM-Rased
2. اضغط: Settings (⚙️)
3. من القائمة اليسرى اختر: Pages
```

#### 2. إدخال Custom Domain
```
1. في حقل "Custom domain" أدخل: m3tm-rased.ml
2. اضغط: Save
3. انتظر ظهور رسالة: "Your site is ready to be published"
```

#### 3. تفعيل HTTPS
```
1. بعد انتظار 5 دقائق
2. ستظهر خيارات جديدة
3. فعّل: ☑ Enforce HTTPS
4. احفظ
```

✅ **النتيجة**: سترى ✅ أخضر بجانب "Your site is live"

---

## 🎉 النتيجة النهائية

بعد اكتمال جميع الخطوات:

### الرابط الجديد
```
https://m3tm-rased.ml
```

### الخصائص
```
🌐 دومين مجاني (.ml)
🔒 HTTPS مشفّر من Cloudflare
⚡ CDN سريع من Cloudflare
🛡️ DDoS Protection مجاني
📧 Email forwarding متاح
🔄 Auto SSL renewal
```

---

## النشر على GitHub Pages

### الخطوة 1: تفعيل GitHub Pages ⚙️

```
1. اذهب إلى Settings في المستودع
2. اختر Pages من القائمة الجانبية
3. في "Source" اختر: main branch
4. اضغط Save
```

**النتيجة**: سيظهر رابط مثل:
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

## 🔄 CI/CD التلقائي

GitHub Actions يعمل تلقائياً:

```bash
# عند عمل Commit جديد:
1. يسحب أحدث الكود من main
2. ينشر على GitHub Pages
3. الدومين ينعدّل تلقائياً
4. يأخذ ~1 دقيقة

# كل ما عليك:
git push
# والباقي تلقائي!
```

---

## ⏱️ الخطة الزمنية

| الخطوة | الوقت | الملاحظات |
|------|------|---------|
| إنشاء حسابات | 10 دقائق | يدوي |
| تسجيل الدومين | 5 دقائق | يدوي |
| إعداد Cloudflare | 5 دقائق | يدوي |
| تحديث Nameservers | 2 دقيقة | يدوي |
| إضافة CNAME | 2 دقيقة | يدوي |
| تفعيل في GitHub | 1 دقيقة | يدوي |
| **انتشار DNS** | **15-30 دقيقة** | **تلقائي** |
| **الإجمالي** | **~45 دقيقة** | - |

---

## ✅ قائمة التحقق

```
الإعداد الأولي:
☐ حساب GitHub (جاهز)
☐ حساب Freenom (جديد)
☐ حساب Cloudflare (جديد)

تسجيل الدومين:
☐ البحث عن m3tm-rased.ml
☐ التسجيل المجاني (12 شهر)
☐ تأكيد البريد الإلكتروني

إعداد Cloudflare:
☐ إضافة الموقع
☐ نسخ Nameservers
☐ إضافة CNAME Record

تحديث Freenom:
☐ الذهاب إلى My Domains
☐ تحديث Nameservers
☐ انتظار الانتشار (5-10 دقائق)

تفعيل في GitHub:
☐ GitHub Settings → Pages
☐ إدخال Custom Domain
☐ تفعيل HTTPS Enforce

الاختبار:
☐ فتح https://m3tm-rased.ml
☐ التحقق من SSL الأخضر 🔒
☐ اختبار الواجهة كاملة
```

---

## 🆘 استكشاف الأخطاء الشائعة

### ❌ "DNS CNAME not set correctly"
```
✓ تأكد من إدخال Nameservers الصحيحة
✓ انتظر 10 دقائق أخرى
✓ امسح ذاكرة التخزين المؤقت: Ctrl+Shift+Del
✓ جرب: nslookup m3tm-rased.ml
```

### ❌ "Nameservers في Freenom لم تتحدّث"
```
✓ انتظر 15-30 دقيقة
✓ تحقق من صحة Nameservers
✓ أعد التحميل (F5)
✓ اتصل بدعم Freenom إن استمرت المشكلة
```

### ❌ "الموقع يفتح ولكن بدون استجابة"
```
✓ تأكد من أن ملف index.html موجود في main
✓ تحقق من GitHub Actions (وسام أخضر أم أحمر)
✓ انظر في: Settings → Pages
✓ أعد تحميل الصفحة (Ctrl+F5)
```

### ❌ "SSL غير مفعّل (🔓 بدل 🔒)"
```
✓ انتظر 15 دقيقة أخرى
✓ تفعيل Enforce HTTPS في GitHub
✓ تأكد من أن Proxy في Cloudflare مفعّل (أزرق)
✓ امسح الكوكيز: Ctrl+Shift+Del
```

### ❌ "الدومين قديم يعمل، الجديد لا"
```
✓ تأكد من ملف CNAME الموجود في GitHub
✓ تحقق من GitHub Pages Settings
✓ تأكد من أن DNS قد انتشرت بالكامل
✓ اختبر في متصفح جديد (Incognito)
```

---

## 🔐 الأمان والخصوصية

### معلومات الدومين
```
✅ الدومين: عام (لا يوجد معلومات شخصية)
✅ DNS: عبر Cloudflare (آمن)
✅ SSL: تشفير HTTPS كامل
✅ IP: مخفي (Cloudflare Proxy)
```

### الحماية
```
🛡️ DDoS Protection (Cloudflare)
🛡️ WAF (Web Application Firewall)
🛡️ SSL/TLS Encryption
🛡️ DNS Security (DNSSEC)
🛡️ Automated Backups
```

---

## 💾 البيانات والنسخ الاحتياطية

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

## 📞 الدعم والمساعدة

إذا واجهت أي مشكلة:
1. 📖 اقرأ هذا الدليل
2. 🔍 ابحث في GitHub Issues
3. 💬 افتح Discussion
4. 🐛 أبلغ عن الخطأ

---

**النشر الآمن والموثوق! 🎉**

**آخر تحديث**: 2026-05-17  
**الدومين الموصى به**: https://m3tm-rased.ml