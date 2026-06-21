# S! Wear Frontend

Egyptian Gen Z streetwear ecommerce app using React, Vite, Tailwind CSS, Wouter, and a zero-dependency Supabase REST client.

## Run Locally

From the monorepo root:

```bash
pnpm install
pnpm --filter @workspace/swear run dev
```

Vite requires these env values in `artifacts/swear/.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-real-anon-key
```

Do not include `/rest/v1` in `VITE_SUPABASE_URL`; the app adds that internally.

## Supabase Setup

Open Supabase Dashboard -> SQL Editor, paste `artifacts/swear/supabase-schema.sql`, and run it.

The SQL is idempotent and safe for existing orders:

- Creates `products` if missing.
- Creates `product_variants` if missing.
- Creates `profiles` if missing for Supabase Auth users and roles.
- Creates `shipping_zones` if missing.
- Creates `contact_messages` if missing.
- Creates `discount_codes` if missing.
- Creates `return_requests` if missing.
- Creates the public `product-images` Supabase Storage bucket if missing.
- Adds `notifications.contact_message_id` if missing.
- Adds `order_items.variant_id` if missing.
- Adds safe cancellation/private-note columns to `orders` if missing.
- Keeps existing `orders` and `order_items` rows.
- Keeps existing shipping/order data and changes only the future default for `orders.shipping_egp` away from the old hardcoded 60 EGP value.
- Enables realtime for `orders` and `notifications`.
- Seeds variants for:
  - Oversized Heavy Cotton T-Shirt
  - Boxy Fit Shirt
  - Wide Leg Pant
- Seeds delivery zones only if they are missing:
  - Giza / Hadayek Al Ahram: 40 EGP
  - Giza default: 60 EGP
  - Cairo default: 70 EGP
  - Alexandria default: 90 EGP
  - Other governorates default: 100 EGP

The SQL file does not use `DROP TABLE`, `TRUNCATE`, or unsafe `DELETE`. Demo seed rows use insert-missing-only behavior and do not overwrite existing product, variant, order, notification, or shipping data.

## Inventory

Inventory is variant-based:

- Product basics live on `products`.
- Size/color stock lives on `product_variants`.
- Total stock is calculated from active variants.
- Cart and orders carry `productId`, `variantId`, `size`, `color`, quantity, and EGP price.
- Stock-managed product categories are only `T-Shirts`, `Shirts`, and `Pants`.
- Custom Design is handled only by `/custom-design`; it is not listed as a shop/admin product category.

## Auth

Production auth uses Supabase Auth plus the `profiles` table.

- Signup creates a Supabase Auth user and a `profiles` row with role `customer`.
- Login uses Supabase Auth and then loads the matching profile.
- Admin access requires `profiles.role = 'admin'`.
- The old localStorage user/admin flow is kept only for development mock mode when Supabase env vars are missing.

To make an admin, create the user in Supabase Auth, then set that user's profile role to `admin` in the `profiles` table.

## Product Images

Production product image uploads go to the public Supabase Storage bucket `product-images`.

If Storage upload is not configured or policies are not ready, admins can still use the image URL fallback. Production uploads should not rely on base64/localStorage images.

## Order Mode

Production orders require Supabase.

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing or placeholders, checkout and admin orders show:

```text
Supabase is not connected. Orders will not reach admin.
```

Production does not silently save orders to localStorage.

Development mode may use localStorage mock orders only when Supabase env vars are missing. The UI shows a `DEV MOCK` badge anywhere this path is used.

Production checkout also requires the API server, because order placement uses a server-side endpoint with the Supabase service role key. Do not put the service role key in the frontend `.env`.

API server env:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
PORT=5001
```

Frontend dev uses `/api` proxy to `http://localhost:5001` by default. Override with:

```env
VITE_API_URL=http://localhost:5001
```

## Checkout

- Cash on Delivery only.
- EGP only.
- No WhatsApp checkout.
- Delivery is calculated from admin-controlled `shipping_zones`.
- Checkout first tries exact governorate + city/area, then governorate default, then the active `Other governorates` default if present.
- If no zone matches, checkout shows `Delivery fee will be confirmed by customer support.` and does not create a misleading automatic 60 EGP total.
- Checkout sends the authenticated customer order to `/api/orders/place`.
- The API verifies the customer Supabase JWT, then calls the service-role-only `place_order_with_items` RPC.
- The RPC validates order ownership, stock, totals, Cash on Delivery payment, Pending status, and inserts `orders` + `order_items` while reducing stock.
- If order placement fails, checkout shows the exact error and does not show success.

## Admin Shipping

Admins can manage delivery fees at `/admin/shipping`.

- Add zones by governorate and optional city/area.
- Empty city/area means governorate default.
- Set delivery fee in EGP.
- Optional free shipping minimum.
- Activate/deactivate zones without deleting data.

## Discounts

Admins manage discount codes at `/admin/discount-codes`.

- Percentage or fixed EGP discounts.
- Optional minimum order total.
- Optional expiry date.
- Active/inactive status.
- Usage count is incremented only after checkout saves the order.
- Checkout saves `discount_code` and `discount_amount` on the order.

## Cancellation And Returns

- Customers can request cancellation from Order Details while an order is `Pending` or `Confirmed`.
- Admin reviews cancellation requests in `/admin/orders`.
- Approved cancellations set the order to `Cancelled` and restore variant stock.
- Delivered orders can request return/exchange from Order Details.
- Admin reviews return/exchange requests at `/admin/returns`.
- Customers receive notifications when admins update requests.

## Contact Messages

Customers must be logged in before sending normal contact messages.

- `/contact` saves support messages to `contact_messages`.
- Customer name, email, and phone are copied from the local profile at submit time.
- Admins view and reply at `/admin/messages`.
- Admin replies update the message, mark it as `replied`, and create a customer notification.
- Customers can see sent messages and replies from the `Messages` tab in Profile.

Normal contact messages do not open WhatsApp. WhatsApp stays only on `/custom-design`.

## Admin Order Tools

- Admin private notes are saved on orders and are only displayed in admin views.
- Print packing/delivery sheets from `/admin/orders/:id/print`.
- Export filtered admin orders as CSV from `/admin/orders`.

## Backup And Migration Safety

Do not run destructive SQL on production data unless you intentionally choose to after taking a backup.

Avoid:

- `DROP TABLE`
- `TRUNCATE`
- `DELETE FROM` without a safe `WHERE`
- Resetting or recreating the database from scratch

Before running migrations:

1. Open Supabase Dashboard.
2. Take a backup from Project Settings -> Database -> Backups, or export important tables from Table Editor.
3. Review `artifacts/swear/supabase-schema.sql`.
4. Confirm changes use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`.
5. Run the SQL in Supabase SQL Editor.
6. Test checkout, admin orders, product stock, shipping zones, discounts, and notifications.

Important tables:

- `orders`: customer orders, totals, shipping, status, cancellation fields, admin notes.
- `order_items`: products, variants, sizes, colors, quantities, and item prices for each order.
- `product_variants`: size/color inventory and stock.
- `products`: product basics and visibility status.
- `notifications`: customer order/request notifications.
- `contact_messages`: customer support messages and admin replies.
- `shipping_zones`: admin-controlled delivery pricing.
- `discount_codes`: coupon setup and usage counts.
- `return_requests`: customer return/exchange requests.

## Realtime

Customer pages subscribe to Supabase Realtime:

- `My Orders` updates status changes for the current `user_id`.
- `Order Details` updates the current order status.
- Profile notifications update when admin inserts a notification.

Admin status updates write `orders.status` and insert a notification for the customer.

Contact-message replies also create notifications and use Supabase Realtime when `contact_messages` and `notifications` are in the realtime publication.

## RLS Note

The app now sends Supabase Auth access tokens through the zero-dependency REST client. The schema tightens the old broad policies for products, variants, orders, order items, notifications, contact messages, return requests, and shipping zones.

Known remaining hardening item: `discount_codes` still needs a safer redemption flow, ideally a database RPC/function for incrementing usage count after checkout. Until that exists, do not treat coupon usage counts as high-security accounting.
