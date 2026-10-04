# Grihini Apna Bazaar — Fixed Build

This build fixes the broken product-loading and admin media flow and adds a working customer cart/checkout/order flow.

## Important
Do NOT upload `.env.local`, Firebase service-account JSON, or Cloudinary API secrets.

Create `.env.local` in the project root with:
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=

Use a Cloudinary unsigned upload preset. Never put a Cloudinary API secret in Vite/browser code.

## Run
1. Open the project folder in VS Code.
2. Open PowerShell in that folder.
3. Run:
   npm install
4. Run:
   npm run dev
5. Customer site: the Vite URL.
6. Admin: add `/admin` to the Vite URL.

## What changed
- Customer site no longer bundles the Admin panel on the normal home page.
- Firestore live products are used when available.
- If Firestore has no live products, the MARG catalogue fallback is loaded from `/data/products.json`.
- Search works against product name, brand, company, code and barcode.
- Categories include the requested grocery structure.
- Cart, quantity, wishlist, recently viewed, coupons and local checkout are functional.
- COD orders are stored locally and also attempted in Firestore.
- Admin Orders/Analytics/Customers/Categories/Media/Settings pages now have working data views.
- Product image upload has validation, compression timeout and Cloudinary upload timeout so it cannot remain stuck forever.
- Product editor continues to save products to Firestore.
- Firebase initialization is safe against duplicate initialization and reads browser config from `.env.local`.

## Payment / OTP
COD is implemented in the current browser flow. Real online payments require a payment provider account plus a server-side order/verification endpoint; do not put provider secrets in the browser.
Phone OTP requires Firebase Phone Authentication and reCAPTCHA to be enabled in Firebase Console.
