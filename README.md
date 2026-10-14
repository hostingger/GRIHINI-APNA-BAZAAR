# Grihini Apna Bazaar

Professional, mobile-first grocery storefront built with React + Vite. Backend is Supabase (free-first) to avoid Firebase Storage's required Blaze billing-plan activation. COD only; companion app is planned after website order flow is verified.

## Quick start

```bash
npm install
npm test
npm run dev
```

For cloud mode, copy `.env.example` to `.env.local`, add the Supabase Project URL and public anon/publishable key, then run `supabase-schema.sql` in Supabase SQL Editor. Follow `SETUP-HI.md` in Hindi to create the admin role and test the full order journey.

**Important:** Demo Mode uses localStorage and does not sync between devices. Production cloud mode requires Supabase setup and a real-device end-to-end test before launch. Never expose a Supabase service-role key in frontend code.
