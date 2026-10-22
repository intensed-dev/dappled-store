# Dappled Store

Storefront for the Dappled Trio on the MineDistrict private Minecraft SMP.

## Project structure

- `index.html` — storefront, product listing, Dappled Dollar packs and checkout
- `styles.css` — responsive dark forest theme
- `app.js` — navigation, catalogue rendering, persistent cart and checkout UI
- `data/products.json` — editable product catalogue
- `data/discounts.json` — creator codes and discount codes
- `worker/src/index.js` — Cloudflare Worker template for secure Discord order notifications
- `worker/wrangler.toml` — Worker configuration
- `copyright_notice.txt` — Minecraft non-affiliation notice, shown in the footer

## Editing products

Add objects to `data/products.json`:

```json
{
  "id": "oak-log-32",
  "name": "32× Oak Log",
  "description": "32 oak logs",
  "price": 5,
  "itemId": "minecraft:oak_log",
  "category": "Holz",
  "active": true
}
```

The `id` must be unique. Prices are in Dappled Dollar (D$). `itemId` is the Minecraft item identifier. You can set an explicit `image` URL; otherwise the frontend attempts to use the item image endpoint configured in `app.js`. Item-image URLs may need adjustment when the Minecraft version changes.

## Dappled Dollar packs

Packs are configured in the `PACKS` array in `app.js`:

- Trinkgeld: 5 D$ for 2 diamonds (no website discount)
- Handvoll: 15 D$ for 4 diamonds
- Truhe voll: 30 D$ for 9 diamonds
- Doppelkiste voll: 60 D$ for 19 diamonds

The website handles order requests only. Payment and delivery are manually arranged in-game.

## Deploying on GitHub Pages

Enable GitHub Pages in the repository settings and publish from the `main` branch / root. The static catalogue, pack listing, search and local cart work without a backend. The cart is saved in the visitor's browser.

## Enable Discord order notifications

**Do not place the Discord webhook URL in frontend code or a public JSON file.** Since a webhook URL was previously shared in chat, rotate/recreate it before deploying.

1. Deploy the Worker in `worker/` using Wrangler.
2. Add a secret named `DISCORD_WEBHOOK_URL` to the Worker environment. Do not commit the value.
3. Set `ALLOWED_ORIGIN` in `worker/wrangler.toml` to the exact deployed storefront origin, then deploy.
4. Set `STORE_CONFIG.orderEndpoint` in `app.js` to the deployed Worker URL.
5. Send a test order and verify the Discord message.

### Important before accepting real orders

The Worker is a **starter template**, not a production payment or inventory system. It sends an order request and explicitly labels it as manual in-game payment. It currently trusts item names/prices sent by the browser, so do not use it for final accounting until server-side catalogue loading, price recalculation, discount-code validation, request rate limiting and order IDs have been implemented. Browser-side JSON files are public and can be read by anyone; code validation in the frontend is only a preview. No payment is verified automatically.

Creator codes and discount codes are both shown in the checkout. The starter discount example in `data/discounts.json` is disabled by default. Change `active` only after setting up server-side validation.

## Fonts and copyright

The existing Minecraft fonts are reused. The text from `copyright_notice.txt` is included in the footer. This is a community SMP shop and is not an official Minecraft product.
