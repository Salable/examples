# Salable PAYG Token Overage

A simple demo of pay-as-you-go overage with Salable. A monthly plan grants an allowance of tokens, and once the customer has consumed them all, further usage is recorded against a meter and billed at the end of the period. It combines the [token billing](https://salable.app/docs/token-billing) and [metered usage](https://salable.app/docs/metered-usage) models in one subscription, building on the [token quick start](../token-quick-start-demo) and [usage quick start](../usage-quick-start-demo) demos.

## What's included?

- **Selling a plan with an allowance and an overage rate.** A monthly _Pro_ subscription with two recurring line items: a [token line item](https://salable.app/docs/token-billing) that grants 1,000 `image_generations` tokens every billing cycle for $29, and a [metered line item](https://salable.app/docs/metered-usage) on the `image_generations` meter at $0.10 per image. It unlocks the `image_generations` entitlement.
- **Feature gating.** Generating images is locked until the grantee has the `image_generations` entitlement.
- **Consuming tokens first, then recording overage.** Each generation asks Salable to consume tokens. While the balance covers it, the tokens are deducted immediately. Once the balance is exhausted, Salable rejects the consume with `422` _Insufficient token balance_ and the demo records the same amount as usage against the meter instead. Every request carries an `Idempotency-Key` so a retried call can never double-charge.
- **Viewing the token balance.** The remaining balance and the records behind it, with their expiry.
- **Viewing overage usage.** The count on the current period's usage record, the estimated overage charge and the history of records with their status.
- **Managing the subscription.** Turn auto-renew off and on, or cancel immediately. See the feature be locked upon cancellation and the usage record finalised.

> NOTE: The [owner](https://salable.app/docs/core-concepts#owner) is hardcoded as `company_acme` and the [grantee](https://salable.app/docs/core-concepts#grantee) as `user_alice`, matching the quick start demos. The [token](https://salable.app/docs/core-concepts#token) and [meter](https://salable.app/docs/core-concepts#meter-slug) share the slug `image_generations`, which is also the name of the [entitlement](https://salable.app/docs/understanding-entitlements).

## Prerequisites

- **A Salable account.** Sign up at [salable.app](https://salable.app/auth/sign-in).
- **Node.js 22 or later and npm.**
- **This demo copied locally and installed dependencies.** The demo lives in the [Salable examples](https://github.com/Salable/examples) repository alongside other demos. Use [degit](https://github.com/Rich-Harris/degit) to copy just this directory without cloning the whole repository.

  ```bash
  npx degit Salable/examples/payg-token-overage-demo payg-token-overage-demo
  cd payg-token-overage-demo
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

2. **Import the example product.** The repository contains a `product.yaml`, which describes the product, its _Pro_ plan and the two `image_generations` line items. Importing it also creates the meter in Salable and Stripe. Import it one of two ways:

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

1. **Start from nothing.** When first opened, generating is locked, there is no subscription, no token balance and no usage records.

2. **Subscribe to Pro.** Press _Subscribe to Pro_. On Stripe's Checkout, pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, and any CVC. Stripe charges $29 for the included tokens; the overage is billed at the end of each period.
   - Once returned to the demo, Generate images is unlocked, the Token balance panel shows 1,000 tokens from the subscription and a `current` usage record with a count of 0 appears in the Overage panel.

3. **Generate within the allowance.** Enter `400` and press _Generate_. The response is tagged _Tokens_ and the balance drops to 600 straight away. Generate `400` again: the balance drops to 200.

4. **Generate beyond the allowance.** Enter `400` once more. Only 200 tokens remain, so Salable rejects the consume with `422` and the demo records all 400 as usage instead. The response is tagged _Overage_, the balance stays at 200 and the usage count rises to 400 within about half a minute (the page polls; press _Refresh_ if you get impatient). The estimated overage charge shows $40.00.

   > NOTE: Salable rejects the whole consume when the balance is insufficient and deducts nothing, so a request larger than the remaining balance is billed entirely as overage. The remaining tokens are kept for a later, smaller request.

5. **Drain the balance.** Enter `200` and press _Generate_. It is paid for with the last tokens, the balance reaches 0 and the form warns that the next generation is billed as overage. Generate `5`: it is tagged _Overage_ and the usage count rises to 405.

6. **Manage the subscription.** In the Pro panel press _Turn off auto-renew_. The badge changes to _Cancels at period end_ and the button flips to _Turn on auto-renew_; press it again to restore.

7. **Cancel Pro.** Press _Cancel subscription_ in the Pro panel and confirm. Once Stripe confirms, the entitlement is removed, Generate images is locked again and the usage record changes from `current` to `final` with a Finalised date. Any tokens left in the balance stay until they expire.

8. **Reset and go again.** Press _Reset demo_ at the bottom and confirm. This removes all of the data created in the demo apart from the imported product and plan.

## Troubleshooting

- **"Salable could not be reached" on load.** `SALABLE_SECRET_KEY` or `SALABLE_PRO_PLAN_ID` is missing from `.env.local`, or the key is not a test mode key (Salable answers _Unauthenticated_). Check the values and restart `npm run dev`.
- **Nothing changes after checkout.** Press _Refresh_ after a moment to refetch the data from Salable.
- **Generate returns 403 even though you just bought Pro.** The webhook may still be in flight. Wait a few seconds, or press _Refresh_.
- **Generate returns "Salable has no usage record".** The balance was exhausted, but Salable has not yet created the usage record for the Pro subscription. Wait a few seconds and try again. If it persists, the owner does not hold a Pro subscription.
- **The overage count has not changed after generating.** Usage is queued and processed in the background, which can take around half a minute. Press _Refresh_ after a short wait. Token consumption, by contrast, is reflected immediately.
- **Entitlements or subscriptions you did not buy appear.** The [token quick start](../token-quick-start-demo) and [usage quick start](../usage-quick-start-demo) demos use the same `company_acme` owner and `user_alice` grantee. If you have run either in the same Salable organisation, its subscriptions are listed under the same owner and _Reset demo_ in any of the demos deletes all of them.
- **Subscribe to Pro says the owner is already subscribed to metered plan items.** Salable prevents a second subscription to the same meter, even after a cancellation. Press _Reset demo_ to delete the cancelled subscription, then subscribe again.

## Further Reading

- [Token billing](https://salable.app/docs/token-billing), reset versus accumulate behaviour, expiry, consuming and the `422` on an empty balance
- [Metered usage](https://salable.app/docs/metered-usage), meters, pricing, billing cycles and the usage records API
- [Record usage](https://salable.app/docs/record-usage), the call behind the overage path
- [Token quick start guide](https://salable.app/docs/token-quick-start) and [usage-based billing quick start guide](https://salable.app/docs/usage-quick-start), the two guides this demo combines
- [Quick checkout](https://salable.app/docs/quick-checkout), every field accepted by `checkout.post`
- [Cancelling a subscription](https://salable.app/docs/cancel-subscription), immediate cancel versus auto-renew
- [Checking entitlements](https://salable.app/docs/check-entitlements), the call that gates the generate panel
- [Salable Node SDK](https://github.com/Salable/sdk)
