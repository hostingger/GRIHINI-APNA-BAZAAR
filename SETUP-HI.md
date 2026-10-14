# Grihini Apna Bazaar — हिंदी Setup Guide (Supabase Free-first)

## क्यों Firebase से Supabase?
Firebase Cloud Storage को नए/मौजूदा buckets के लिए 3 February 2026 से Blaze billing plan चाहिए। इसलिए product image/video upload शुरू करने में billing setup अटक सकता है। Supabase Free में database, email/password auth और file storage के free quotas मिलते हैं; कार्ड/भुगतान की जरूरत हो सकती है या नहीं, यह account और provider onboarding पर निर्भर हो सकता है। Free projects एक सप्ताह निष्क्रिय रहने पर pause हो सकते हैं, इसलिए यह शुरुआती/testing के लिए अच्छा है, पर production uptime की गारंटी नहीं। आधिकारिक जानकारी: https://supabase.com/pricing और https://supabase.com/docs/guides/platform/billing-on-supabase

## 1. कंप्यूटर पर चलाएँ

1. ZIP Extract करें; `grihini-apna-bazaar` folder खोलें। Node.js 20+ install हो।
2. Terminal में चलाएँ:

```bash
npm install
npm test
npm run dev
```

3. Terminal में दिए localhost URL को browser में खोलें। Backend config न होने पर Demo Mode चलेगा—डेटा उसी browser तक सीमित है।

## 2. Supabase free project सेट करें

1. https://supabase.com/dashboard पर नया project बनाएँ। Free plan चुनें; भुगतान/upgrade के लिए प्रेरित करने वाले add-ons को न चुनें।
2. Project Settings → API से Project URL और publishable/anon key कॉपी करें।
3. Project folder में `.env.example` की copy `.env.local` नाम से बनाएँ और values भरें:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

4. Supabase Dashboard → SQL Editor में `supabase-schema.sql` की पूरी सामग्री चलाएँ।
5. Authentication → Users में अपना Admin user बनाएं (email/password)। फिर SQL Editor में नीचे का SQL चलाएँ, email को अपने Admin email से बदलें:

```sql
insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (user_id) do update set role = 'admin';
```

6. Dev server रोककर फिर `npm run dev` चलाएँ। Admin portal में उसी email/password से sign in करें।
7. एक order place करें; Admin में order दिखे; status क्रम से Accepted → Packed → Out for delivery → Delivered करें। Tracking code से customer tracking भी जाँचें।

## सुरक्षा

- `.env.local` में केवल Supabase Project URL और public anon/publishable key रखें। `service_role` / secret key को कभी frontend में न डालें या साझा न करें।
- `supabase-schema.sql` में RLS policies हैं। Customers order table को सीधे पढ़ नहीं सकते; tracking RPC केवल दिए tracking code का order लौटाता है। Admin role केवल SQL Editor से जोड़ा जाना चाहिए।
- Live launch से पहले वास्तविक products/prices/stock/delivery rules भरें, test order रद्द/डिलीवर करके जाँचें, और backups/export की व्यवस्था रखें।
- Supabase Free projects एक सप्ताह inactivity के बाद pause हो सकते हैं; इसे production uptime की गारंटी न मानें।

## पहले से शामिल सुविधाएँ

- Responsive customer store, category/search, cart, wishlist, COD checkout
- Tracking code और order status timeline
- Admin sign-in, order updates, product create/edit/archive, image/video upload
- CSV/Excel/JSON/text-based PDF import, CSV export, reports
- Loading/error/empty states और automated order logic tests

## सीमाएँ

- Demo Mode में order sync दूसरे device पर नहीं होगा। Supabase credentials और schema सेट होने पर cloud mode सक्रिय होगा।
- Scanned/image-only PDFs को OCR की आवश्यकता है।
- Online payment अभी जानबूझकर बंद है; केवल COD है।
- Android/iOS app अगला चरण होगा—पहले इसी backend के साथ website order flow को वास्तविक devices पर test और स्थिर किया जाएगा।


## Homepage Banner / Storefront Settings (नया)

Admin Panel में **Storefront** tab से homepage की hero/landscape image और promotional banner image/title/text बदले जा सकते हैं।

Supabase project में यह सुविधा चालू करने के लिए `storefront-migration.sql` को SQL Editor में **एक बार** चलाएँ। यह `public.store_settings` table और सीमित RLS policies बनाता है: public केवल homepage settings पढ़ सकता है; write केवल Admin role वाला authenticated user कर सकता है।

फिर Admin Portal → Storefront खोलें, image upload करें या URL दें, और **Save homepage settings** दबाएँ। Image upload के लिए `product-media` Storage bucket और admin upload policy पहले से configured होनी चाहिए।

Product editor में अधिकतम 3 product photos एक साथ upload किए जा सकते हैं। Customer product cards पर फोटो के dots/arrows या मोबाइल पर swipe से बदले जा सकते हैं। अगर product के `images` array में कई URLs नहीं हैं, तो एक ही फोटो दिखाई देगी।

ध्यान दें: `storefront-migration.sql` को मौजूदा `supabase-schema.sql` दोबारा चलाने के बजाय अलग migration के रूप में चलाएँ।
