# Salable Flat-Rate Quick Start

A simple demo following the [Salable Flat-Rate Billing Quick Start](https://salable.app/docs/flat-rate-quick-start). The guide explains how to charge a fixed recurring fee and gate features with Salable; this repository lets you follow the guide and see it in action.

## What's included?

- **Selling a flat-rate plan.** A monthly _Pro_ subscription with a [flat-rate line item](https://salable.app/docs/products-and-pricing#line-item-types) at $20 per month. It unlocks the `ad_free_listening` entitlement.
- **Feature gating.** Ad-free listening is locked until an [entitlement check](https://salable.app/docs/check-entitlements), returns the `ad_free_listening` entitlement. The check runs on the server in `/api/play` before the track is allowed to play, and on the client to hide the player. The playback itself is simulated; only the entitlement check is real.
- **Viewing the entitlement check.** What the check returns for the grantee, with its type and expiry, so you can watch `ad_free_listening` appear after checkout and disappear after cancellation.
- **Managing the subscription.** Turn auto-renew off and on, or cancel immediately. See the feature be automatically locked upon cancellation.

> NOTE: To keep the code identical to the guide, the [owner](https://salable.app/docs/core-concepts#owner) is hardcoded as `company_acme`, the [grantee](https://salable.app/docs/core-concepts#grantee) as `user_alice` and the [entitlement](https://salable.app/docs/understanding-entitlements) as `ad_free_listening`.

## Prerequisites

- **A Salable account.** Sign up at [salable.app](https://salable.app/auth/sign-in).
- **Node.js 22 or later and npm.**
- **This demo copied locally and installed dependencies.**

  ```bash
  npx degit Salable/examples/flat-rate-quick-start-demo flat-rate-quick-start-demo
  cd flat-rate-quick-start-demo
  npm install
  ```

- **Create a `.env.local` file.** Duplicate `.env.example` and rename the copy to `.env.local`.

  ```bash
  cp .env.example .env.local
  ```

## Setup

1. **Add your Salable secret key.** In the Salable dashboard switch to **test mode**, [open the API keys page](https://salable.app/dashboard/api-keys), copy the secret key and paste it into `.env.local`:

   ```dotenv
   SALABLE_SECRET_KEY="sk_test_..."
   ```

   > NOTE: The key never leaves the server. It is only read inside API routes and `getServerSideProps`.

2. **Import the example product.** The repository contains a `product.yaml`, which describes the _Music Streaming_ product, its _Pro_ plan, the flat-rate line item and the `ad_free_listening` entitlement mirroring the guide. Import it one of two ways:

   - **Script (recommended).** Run

     ```bash
     npm run import:salable-product
     ```

     It uploads `product.yaml` to Salable and logs the environment variable you need. Copy the printed line into your `.env.local`.

   - **Dashboard.** [Go to the Products page](https://salable.app/dashboard/products), choose _Upload YAML_ and upload `product.yaml`. Then open the _Pro_ plan and copy its ID into `.env.local`:

     ```dotenv
     SALABLE_PRO_PLAN_ID="plan_..."
     ```

3. **Start the app.**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Using the Demo

1. **Start from nothing.** When first opened, Ad-free listening is locked, there is no subscription and the entitlement check returns nothing.

2. **Subscribe to Pro.** Press _Subscribe to Pro_. On Stripe's Checkout, pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, and any CVC. Stripe charges the $20 flat rate up front and again at the start of every month.
   - Once returned to the demo, Ad-free listening is unlocked and the Entitlement check panel lists `ad_free_listening`.

3. **Play a track ad-free.** Choose a track and press _Play ad-free_. The server repeats the entitlement check, finds `ad_free_listening` and allows the play. Nothing is streamed; the message confirms only the entitlement check was real.

4. **Manage the subscription.** In the Pro panel press _Turn off auto-renew_. The badge changes to _Cancels at period end_ and the button flips to _Turn on auto-renew_; press it again to restore. With auto-renew off the entitlement stays until the end of the paid period.

5. **Cancel Pro.** Press _Cancel subscription_ in the Pro panel and confirm. Once Stripe confirms, `ad_free_listening` drops out of the entitlement check and Ad-free listening is locked again.

6. **Reset and go again.** Press _Reset demo_ at the bottom and confirm. This removes all of the data created in the demo apart from the imported product and plan.

## Troubleshooting

- **"Salable could not be reached" on load.** `SALABLE_SECRET_KEY` or `SALABLE_PRO_PLAN_ID` is missing from `.env.local`. Check the values and restart `npm run dev`.
- **Nothing changes after checkout.** Press _Refresh_ after a moment to refetch the data from Salable.
- **Play returns 403 even though you just bought Pro.** The webhook may still be in flight. Wait a few seconds, or press _Refresh_. If it persists, the entitlement check is not returning `ad_free_listening`; confirm the Pro plan grants it and the check is passing both the `granteeId` and the `owner`.
- **Entitlements or subscriptions you did not buy appear.** The other demos in this repository use the same `company_acme` owner and `user_alice` grantee. If you have run one in the same Salable organisation, its subscriptions are listed under the same owner and _Reset demo_ in any demo deletes every demo's subscriptions.

## Further Reading

- [Flat-rate billing quick start guide](https://salable.app/docs/flat-rate-quick-start), the guide this repository follows step by step
- [Products and pricing](https://salable.app/docs/products-and-pricing), products, plans, line items and pricing types
- [Quick checkout](https://salable.app/docs/quick-checkout), every field accepted by `checkout.post`
- [Cancelling a subscription](https://salable.app/docs/cancel-subscription), immediate cancel versus auto-renew
- [Checking entitlements](https://salable.app/docs/check-entitlements), the call that gates the player
- [Tier tags](https://salable.app/docs/core-concepts#tier-tags-and-tier-sets), making plans such as Basic and Pro mutually exclusive
- [Salable Node SDK](https://github.com/Salable/sdk)
