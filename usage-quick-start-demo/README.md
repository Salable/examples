# Salable Usage Quick Start

A simple demo following the [Salable Usage-Based Billing Quick Start](https://salable.app/docs/usage-quick-start). The guide explains how to charge customers for what they consume, record usage against a meter and gate features with Salable; this repository lets you follow the guide and see it in action.

## What's included?

- **Selling a metered plan.** A monthly _Pro_ subscription with a [metered line item](https://salable.app/docs/metered-usage) on the `image_generations` meter at $0.10 per image. It unlocks the `image_generations`, `high_resolution_exports` and `priority_processing` entitlements. When the customer completes checkout, Salable creates a usage record for the billing period.
- **Feature gating.** Generating images is locked until the grantee has the `image_generations` entitlement. The example "Export HD" feature is locked until the grantee has the `high_resolution_exports` entitlement; it shows a gated feature that records no usage.
- **Recording usage.** Each generation records an increment against the meter, with an `Idempotency-Key` on every request so a retried call can never count the same generation twice. Salable answers immediately and increments the record in the background.
- **Handling missing usage records.** Recording usage without a Pro subscription returns a 404 from Salable, which the demo turns into a readable message.
- **Viewing current usage.** The count on the current period's usage record, the estimated charge and the history of records with their status.
- **Managing the subscription.** Turn auto-renew off and on, or cancel immediately. See the features be automatically locked upon cancellation and the usage record finalised.

> NOTE: To keep the code identical to the guide, the [owner](https://salable.app/docs/core-concepts#owner) is hardcoded as `company_acme`, the [grantee](https://salable.app/docs/core-concepts#grantee) as `user_alice`, the [meter](https://salable.app/docs/core-concepts#meter-slug) as `image_generations` and the [entitlements](https://salable.app/docs/understanding-entitlements) as `image_generations`, `high_resolution_exports` and `priority_processing`.

## Prerequisites

- **A Salable account.** Sign up at [salable.app](https://salable.app/auth/sign-in).
- **Node.js 22 or later and npm.**
- **This demo copied locally and installed dependencies.** The demo lives in the [Salable examples](https://github.com/Salable/examples) repository alongside other demos. Use [degit](https://github.com/Rich-Harris/degit) to copy just this directory without cloning the whole repository.

  ```bash
  npx degit Salable/examples/usage-quick-start-demo usage-quick-start-demo
  cd usage-quick-start-demo
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

2. **Import the example product.** The repository contains a `product.yaml`, which describes the product, its _Pro_ plan and the `image_generations` metered line item mirroring the guide. Importing it also creates the meter in Salable and Stripe. Import it one of two ways:

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

1. **Start from nothing.** When first opened, the features are locked, there is no subscription and there are no usage records.

2. **Subscribe to Pro.** Press _Subscribe to Pro_. On Stripe's Checkout, pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, and any CVC. Stripe charges nothing up front; the metered usage is billed at the end of each period.
   - Once returned to the demo, Generate images and Export HD are unlocked and a `current` usage record with a count of 0 appears in the Usage panel.

3. **Generate images.** Enter `5` and press _Generate_. Salable records the usage in the background, so the count rises to 5 within about half a minute and the estimated charge shows $0.50. The page polls for the change; press _Refresh_ if you get impatient.

4. **Generate more.** Enter `20` and press _Generate_. The count accumulates to 25 and the estimated charge to $2.50. Usage is tracked per owner, so every grantee under `company_acme` would add to the same record.

5. **Manage the subscription.** In the Pro panel press _Turn off auto-renew_. The badge changes to _Cancels at period end_ and the button flips to _Turn on auto-renew_; press it again to restore.

6. **Cancel Pro.** Press _Cancel subscription_ in the Pro panel and confirm. Once Stripe confirms, the entitlements are removed, Generate images and Export HD are locked again and the usage record changes from `current` to `final` with a Finalised date.

7. **Reset and go again.** Press _Reset demo_ at the bottom and confirm. This removes all of the data created in the demo apart from the imported product and plan.

## Troubleshooting

- **"Salable could not be reached" on load.** `SALABLE_SECRET_KEY` or `SALABLE_PRO_PLAN_ID` is missing from `.env.local`, or the key is not a test mode key (Salable answers _Unauthenticated_). Check the values and restart `npm run dev`.
- **Nothing changes after checkout.** Press _Refresh_ after a moment to refetch the data from Salable.
- **Generate returns 403 even though you just bought Pro.** The webhook may still be in flight. Wait a few seconds, or press _Refresh_.
- **Generate returns "Salable has no usage record".** Salable creates the usage record when the Pro subscription starts, a moment after checkout. Wait a few seconds and try again. If it persists, the owner does not hold a Pro subscription.
- **The count has not changed after generating.** Usage is queued and processed in the background, which can take around half a minute. Press _Refresh_ after a short wait.
- **Entitlements or subscriptions you did not buy appear.** The [token quick start demo](../token-quick-start-demo) uses the same `company_acme` owner and `user_alice` grantee. If you have run it in the same Salable organisation, its subscriptions are listed under the same owner and _Reset demo_ in either demo deletes both demos' subscriptions.
- **Subscribe to Pro says the owner is already subscribed to metered plan items.** Salable prevents a second subscription to the same meter, even after a cancellation. Press _Reset demo_ to delete the cancelled subscription, then subscribe again.

## Further Reading

- [Usage-based billing quick start guide](https://salable.app/docs/usage-quick-start), the guide this repository follows step by step
- [Metered usage](https://salable.app/docs/metered-usage), meters, pricing, billing cycles and the usage records API
- [Record usage](https://salable.app/docs/record-usage), the call behind the Generate button
- [Quick checkout](https://salable.app/docs/quick-checkout), every field accepted by `checkout.post`
- [Cancelling a subscription](https://salable.app/docs/cancel-subscription), immediate cancel versus auto-renew
- [Checking entitlements](https://salable.app/docs/check-entitlements), the call that gates the generate panel
- [Salable Node SDK](https://github.com/Salable/sdk)
