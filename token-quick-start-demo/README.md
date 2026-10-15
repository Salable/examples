# Salable Token Quick Start

A simple demo following the [Salable Token Quick Start](https://salable.app/docs/token-quick-start). The guide explains how to sell and consume tokens as well as gate features with Salable; this repository let's you follow the guide and see it action.

## What's included?

- **Selling a recurring token plan.** A monthly _Starter_ subscription that grants 1,000 `image_tokens` every billing cycle and unlocks the `generate_images` and `export_hd` entitlements. It is the only plan that grants `export_hd` and enables the associated feature.
- **Selling a one-off top-up.** A one-off _Token Top-Up_ plan that adds 1,000 tokens. Each purchase creates a [perpetual subscription](https://salable.app/docs/subscriptions-and-billing#perpetual-subscriptions) that grants the `generate_images` entitlement, so a one-off purchase can also consume tokens.
- **Feature gating.** The ability to consume tokens is locked until the grantee has the `generate_images` entitlement. The example "Export HD" feature is locked until the grantee has the `export_hd` entitlement.
- **Consuming tokens.** Spend any number of tokens from the available balance, with an `Idempotency-Key` on every request so a retried call can never double-charge.
- **Handling empty balances.** Attempting to consume more tokens than you hold returns the error "Insufficient token balance".
- **Viewing the current balance.** The total remaining balance and the breakdown per source including when it expires and if it came from a subscription or a one-off purchase.
- **Managing the subscription.** Turn auto-renew off and on, or cancel immediately. See the features be automatically locked upon cancellation.

> NOTE: To keep the code identical to the guide, the [owner](https://salable.app/docs/core-concepts#owner) is hardcoded as `company_acme`, the [grantee](https://salable.app/docs/core-concepts#grantee) as `user_alice`, the [token](https://salable.app/docs/core-concepts#token) as `image_tokens` and the [entitlements](https://salable.app/docs/understanding-entitlements) as `generate_images` and `export_hd`.

## Prerequisites

- **A Salable account.** Sign up at [salable.app](https://salable.app/auth/sign-in).
- **Node.js 22 or later and npm.**
- **This demo copied locally and installed dependencies.** The demo lives in the [Salable examples](https://github.com/Salable/examples) repository alongside other demos. Use [degit](https://github.com/Rich-Harris/degit) to copy just this directory without cloning the whole repository.

  ```bash
  npx degit Salable/examples/token-quick-start-demo token-quick-start-demo
  cd token-quick-start-demo
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

2. **Import the example product.** The repository contains a `product.yaml`, which describes the product, its two plans and the `image_tokens` token line items mirroring the guide. Import it one of two ways:

   - **Script (recommended).** Run

     ```bash
     npm run import:salable-product
     ```

     It uploads `product.yaml` to Salable and logs the environment variables you need. Copy the printed lines into your `.env.local`.

   - **Dashboard.** [Go to the Products page](https://salable.app/dashboard/products), choose _Upload YAML_ and upload `product.yaml`. Then open the _Starter_ plan and the _Token Top-Up_ plan and copy each plan's ID into `.env.local`:

     ```dotenv
     SALABLE_STARTER_PLAN_ID="plan_..."
     SALABLE_TOP_UP_PLAN_ID="plan_..."
     ```

3. **Start the app.**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Using the Demo

1. **Start from nothing.** When first opened the demo, the features are locked, there's no subscriptions and no token balances. 

2. **Subscribe to Starter.** Press _Subscribe to Starter_. On Stripe's Checkout, pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, and any CVC.
   - Once returned to the demo, you'll see the consume feature and export HD feature are unlocked. 

3. **Consume tokens.** Enter `25` and press _Consume_. The balance drops and the records' remaining amount updates.

4. **Over consume tokens.** Enter a number greater than the available balance (e.g. `5000`). The request will reject showing the message, _Insufficient token balance_.

5. **Buy top-up tokens.** Press _Buy 1,000 tokens_ in the Top-Up panel. Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, and any CVC.
   - Observe your token balance was incremented by 1,000

6. **Consume more tokens.** Enter `50` and press _Consume_. The balance drops and the records' remaining amount updates. Consuming tokens uses the token balances in order of expiration, starting with the soonest, then the furthest expiry before finally using records with no expiry. Once a record is fully consumed, it is no longer returned.

7. **Manage the subscription.** Press _Turn off auto-renew_. The badge changes to _Cancels at period end_ and the button flips to _Turn on auto-renew_; press it again to restore. Then press _Cancel subscription_ and confirm. Once cancelled, the associated entitlements are removed from the grantee and the Export HD feature is locked again. The Consume panel stays unlocked because the top-up's perpetual subscription still grants `generate_images`, and the tokens already granted remain in the balance until they expire.

8. **Reset and go again.** Press _Reset demo_ at the bottom and confirm. This removes all of the data created in the demo apart from the seeded products and plans.

## Troubleshooting

- **"Salable could not be reached" on load.** `SALABLE_SECRET_KEY` or a plan ID is missing from `.env.local`, or the key is not a test mode key (Salable answers _Unauthenticated_). Check the values and restart `npm run dev`.
- **Nothing changes after checkout.** Press _Refresh_ after a moment to refetch the data from Salable.
- **Consume returns 403 even though you just bought a plan.** The webhook may still be in flight. Wait a few seconds, or press _Refresh_.

## Further Reading

- [Token quick start guide](https://salable.app/docs/token-quick-start), the guide this repository follows step by step
- [Token billing concepts](https://salable.app/docs/token-billing), reset versus accumulate behaviour, expiry and webhooks
- [Quick checkout](https://salable.app/docs/quick-checkout), every field accepted by `checkout.post`
- [Perpetual (one-off) subscriptions](https://salable.app/docs/perpetual-subscriptions-quick-start), how a one-off purchase is represented
- [Cancelling a subscription](https://salable.app/docs/cancel-subscription), immediate cancel versus auto-renew
- [Checking entitlements](https://salable.app/docs/check-entitlements), the call that gates the consume panel
- [Salable Node SDK](https://github.com/Salable/sdk)
