# 🌐 دليل إعداد النشر والدومين - M3TM RASED

## 📋 المحتويات
1. [تفعيل GitHub Pages](#1-تفعيل-github-pages)
2. [الحصول على دومين مجاني](#2-الحصول-على-دومين-مجاني-freenom)
3. [ربط Cloudflare (اختياري)](#3-استخدام-cloudflare-اختياري)
4. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## 1. تفعيل GitHub Pages

### الخطوة 1: اذهب إلى إعدادات المستودع
- افتح مستودعك على GitHub: `https://github.com/TU4714315/M3TM-Rased`
- انقر على `Settings` (الإعدادات)
- اختر `Pages` من القائمة الجانبية

### الخطوة 2: اختر مصدر النشر
- اختر **Deploy from a branch**
- اختر الفرع: **main**
- اختر المجلد: **/root** أو **/docs** (عادة `/root`)
- انقر **Save**

### الخطوة 3: انتظر التفعيل
- ستظهر رسالة خضراء: "Your site is live at https://yourusername.github.io/M3TM-Rased"
- ستستغرق حوالي 5-10 دقائق

### ✅ اختبر الموقع
```
https://TU4714315.github.io/M3TM-Rased/
```

---

## 2. الحصول على دومين مجاني (Freenom)

### 🎯 الخيار الأول: Freenom (.ml, .tk, .ga, .cf)

#### الخطوة 1: انسخ دومين
1. اذهب إلى **[freenom.com](https://www.freenom.com)**
2. انقر **Services > Register a New Domain**
3. ابحث عن دومين يعجبك: مثلاً `m3tm-rased.ml`
4. انقر **Check Availability**
5. انقر الدومين واختر **Get It Now**

#### الخطوة 2: أكمل التسجيل
- اختر مدة مجانية: **12 Months @ FREE**
- أكمل البيانات (البريد الإلكتروني، البيانات الشخصية)
- انقر **Complete Order**

#### الخطوة 3: تفعيل الدومين للـ GitHub Pages
1. في Freenom، اذهب إلى **Manage Domains**
2. اختر دومينك
3. انقر **Manage Domain** 
4. اختر **Nameservers**

##### إذا كنت **بدون Cloudflare**:
أضف سجلات DNS التالية:

```
Type: A | Name: @ | Target: 185.199.108.153
Type: A | Name: @ | Target: 185.199.109.153
Type: A | Name: @ | Target: 185.199.110.153
Type: A | Name: @ | Target: 185.199.111.153
Type: CNAME | Name: www | Target: yourusername.github.io
```

##### إذا كنت **تستخدم Cloudflare**:
استخدم nameservers من Cloudflare (انظر الخطوة 3)

#### الخطوة 4: ربط الدومين مع GitHub Pages
1. في GitHub، اذهب إلى `Settings > Pages`
2. في **Custom domain** أدخل: `yourdomain.ml`
3. انقر **Save**
4. GitHub سيتحقق من DNS (قد يستغرق 24 ساعة)
5. بعد التحقق، فعّل **Enforce HTTPS**

### ⏏️ نصيحة مهمة
- استخدم **.ml** بدلاً من **.tk** لأنه أكثر موثوقية
- تأكد من تجديد الدومين سنوياً (Freenom يذكرك)
- احفظ بيانات تسجيلك في مكان آمن

---

## 3. استخدام Cloudflare (اختياري)

### فوائد Cloudflare
- 🚀 أداء أفضل
- 🔒 أمان إضافي
- ⚡ CDN مجاني
- 📊 تحليلات

### الخطوة 1: إنشاء حساب Cloudflare
1. اذهب إلى **[cloudflare.com](https://www.cloudflare.com)**
2. انقر **Sign Up** (تسجيل)
3. ادخل بريدك الإلكتروني وكلمة المرور
4. اختر الخطة المجانية **Free Plan**

### الخطوة 2: أضف موقعك
1. انقر **+ Add a Site**
2. أدخل دومينك: `yourdomain.ml`
3. انقر **Continue**
4. اختر الخطة المجانية **Free**
5. انقر **Continue**

### الخطوة 3: غيّر Nameservers في Freenom
Cloudflare سيعطيك nameservers جديدة. مثلاً:
- `ns1.cloudflare.com`
- `ns2.cloudflare.com`

في Freenom:
1. اذهب إلى دومينك
2. اختر **Nameservers**
3. اختر **Use custom nameservers**
4. أدخل nameservers من Cloudflare
5. انقر **Change Nameservers**

### الخطوة 4: أضف سجلات DNS في Cloudflare
في لوحة Cloudflare:
1. اذهب إلى **DNS > Records**
2. أضف السجلات:

```
Type: A | Name: @ | Content: 185.199.108.153
Type: A | Name: @ | Content: 185.199.109.153
Type: A | Name: @ | Content: 185.199.110.153
Type: A | Name: @ | Content: 185.199.111.153
Type: CNAME | Name: www | Content: yourusername.github.io
```

### ⏳ الانتظار
DNS قد تستغرق **24-48 ساعة** للتفعيل الكامل

---

## استكشاف الأخطاء

### ❌ المشكلة: الدومين لا يعمل
**الحل:**
- تحقق من سجلات DNS (قد تحتاج لـ 24 ساعة)
- استخدم أداة DNS Checker: `dnschecker.org`
- تأكد من صحة الـ nameservers

### ❌ المشكلة: موقع GitHub Pages لا يفتح
**الحل:**
- تأكد من تفعيل GitHub Pages
- تحقق من أن الملفات في `/public`
- انتظر 5-10 دقائق بعد الفعيل

### ❌ المشكلة: HTTPS لا يعمل
**الحل:**
- انتظر 24 ساعة بعد فعيل الدومين
- جرب مسح الـ cache (Ctrl+Shift+Del)
- تأكد من **Enforce HTTPS** مفعّل

### ❌ المشكلة: Cloudflare يعطي خطأ
**الحل:**
- تأكد من إدخال DNS بشكل صحيح
- انتظر propagation
- استخدم DNS Propagation Checker

---

## 🎉 النتيجة النهائية

بعد إكمال جميع الخطوات:

✅ موقعك يعمل على: `https://yourdomain.ml`  
✅ نشر تلقائي عند كل push  
✅ أمان HTTPS مفعّل  
✅ CDN Cloudflare يحسّن الأداء  

---

## 📚 موارد مفيدة

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Freenom Support](https://www.freenom.com/en/faq.html)
- [Cloudflare Docs](https://developers.cloudflare.com/)
- [DNS Propagation Checker](https://dnschecker.org)

---

**تم الآن! موقعك جاهز للعالم! 🚀**
