# حروف المغرب — نشرة تحديث الإصدار 2.0

## معلومات الإصدار
- **اسم الإصدار:** 2.0.0
- **رقم الإصدار:** 2
- **الحزمة:** com.huroofalmaghrib

---

## ملاحظات التحديث — Google Play Console

### العربية (ar)
```
تحديث الإصدار 2.0 🎉

✨ تصميم المتجر محسّن بالكامل مع ترتيب جديد للأقسام
🦁 نظام الأفاتار: عرض دائري بتأثيرات النادرية (عادي / نادر / ملحمي / أسطوري)
🎡 العجلة اليومية والصناديق الغامضة في مقدمة المتجر
🎮 تحسينات الأداء وسلاسة الحركة في جميع الشاشات
🔊 إصلاح الأصوات في إصدار APK — جميع الأصوات تعمل بشكل صحيح الآن
🐛 إصلاح أخطاء وتحسين الاستقرار العام
👥 تحسين نظام الأصدقاء: البحث بالاسم أو الكود WM-XXXXXX
```

### الإنجليزية (en-US) — اختياري
```
Version 2.0 Update 🎉

✨ Fully redesigned shop with improved section order
🦁 Avatar system: circular display with rarity glow rings (Common / Rare / Epic / Legendary)
🎡 Daily Spin Wheel and Mystery Boxes now appear first in the shop
🎮 Performance improvements and smoother animations across all screens
🔊 Fixed sound playback in production APK builds
🐛 Bug fixes and general stability improvements
👥 Improved friends system: search by name or WM-XXXXXX code
```

---

## ترتيب أقسام المتجر (الجديد)
1. العروض اليومية
2. العجلة
3. الصناديق الغامضة
4. الأفاتار
5. التأثيرات
6. الألقاب
7. حزم العملات

---

## تغييرات تقنية
- `assetBundlePatterns: ["**/*"]` مضاف لـ app.json — ضمان تضمين ملفات الصوت في APK
- `expo-av` مضاف للـ plugins — تهيئة Audio صحيحة على Android/iOS
- تحميل مسبق لجميع الأصوات عند بدء التطبيق
- إصلاح بحث الأصدقاء: يدعم الآن الاسم + كود WM-XXXXXX
- نظام الإصدار: version "2.0.0" / versionCode 2

---

## ملاحظات ما قبل الرفع
- [ ] بناء APK/AAB جديد عبر EAS Build
- [ ] اختبار الأصوات على جهاز حقيقي
- [ ] اختبار نظام الأصدقاء على جهازين مختلفين
- [ ] التحقق من الاتصال بخادم Railway
- [ ] رفع الـ AAB على Google Play Console تحت "Production"
