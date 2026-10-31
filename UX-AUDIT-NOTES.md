# Grihini Apna Bazaar — UX Audit Notes

Date: 2026-11-01
Branch: `ux-audit-fixes-20261101`
Base: `seo-blue-final`
Scope: safe layout/scroll CSS improvements; preserve business logic and Supabase data.

## Changes made in this pass
- Dialogs/modals now use safe-area-aware padding on phones and retain a scrollable overlay for short/tall viewport cases.
- Modal/drawer vertical auto margins help keep dialogs centered when they fit and allow top access when content exceeds viewport height.
- Mobile dialogs use viewport-relative max heights and responsive width/padding.
- Scroll targets (`#shop`, `#store-info`, category showcase) account for the sticky header to reduce headings being hidden after anchor scrolling.
- Admin tabs remain horizontally scrollable and tab items avoid shrinking into unreadable widths.
- Added overscroll containment for dialogs to reduce scroll bleed into the page behind them.

## Source review observations
- Storefront search input triggers shop scrolling on the first query and Enter; search is intended to span the live catalogue and barcode matching is handled by catalog utilities.
- Customer product list is progressively rendered (24 at a time); admin catalogue list paginates.
- Product gallery supports saved images and selecting/removing images in the editor.
- Cart, checkout, order history, tracking and admin dashboard are implemented in the existing React app; this pass deliberately did not alter order/auth/database logic.
- Supabase catalogue reads use stable pagination; orders/products/settings have realtime plus polling fallback.

## Verification status
- [x] Changes committed to the audit branch.
- [x] Reviewed the relevant source CSS and React markup.
- [ ] Browser visual test of desktop/tablet/mobile dialogs and sticky-header scroll targets.
- [ ] Real-device test of search result positioning, keyboard behavior and barcode scanner input.
- [ ] Click-through test of product details, cart, checkout, order history, tracking and admin tabs.
- [ ] Production build and test suite execution (not available through the connected source interface in this pass).
- [ ] Verify exact fixed production alias after any future merge/deploy.

## Needs browser/device session
These cannot be honestly marked fixed without browser interaction:
1. Search dropdown/results placement and whether it overlays or shifts the page unexpectedly.
2. Any specific button that fails to open its expected panel/dialog.
3. Pixel-level centering/positioning on the user's phone and laptop, including browser zoom and short-height screens.
4. Sticky header overlap while scrolling through all sections.
5. Admin panel visual polish against the actual logged-in admin screens and data volume.
6. Console/network errors from Supabase auth, RPC, Storage, or realtime at runtime.
7. Full order lifecycle test (place COD order, accept/reject, tracking status, inventory effects).

## Benefits
- Dialog content should remain reachable on small screens and short browser windows.
- Scroll-to-section navigation should land with the section heading visible below the sticky header.
- Admin navigation remains usable on narrow screens.
- Existing checkout/order/database behavior and user data were not changed by this CSS-only pass.
