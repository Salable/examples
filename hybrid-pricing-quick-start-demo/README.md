# Salable Hybrid Pricing Quick Start

A simple demo following the [Salable Hybrid Pricing Quick Start](https://salable.app/docs/hybrid-pricing-quick-start). The guide explains how to combine multiple pricing models such as per-seat, metered, and token billing on one subscription and gate features based on what an owner-scoped entitlement check returns. This repository lets you see the guide in action while also showing extra functionality like two plans sharing the same meter but charging different rates or the same user holding different access depending on their active workspace and it's associated subscription.

## What's included?

- **Selling two plans that each combine pricing types.** A monthly _Personal_ plan with a $9.00 flat-rate line item plus a metered line item charging $0.25 per PDF export. And, a second monthly _Team_ plan with a per-seat line item at $12.00 per seat capped at 2 seats, a metered line item at $0.10 per PDF export and a token line item granting 100 `ai_credits` tokens for $5.00. See [combining line items](https://salable.app/docs/products-and-pricing#combining-multiple-line-items) for more examples on combining line item types.
- **The same meter at two rates.** Each plan uses the same `pdf_exports` [meter](https://salable.app/docs/core-concepts#meter-slug). But, the rate billed for the recorded usage depends on which plan the [owner](https://salable.app/docs/core-concepts#owner) is subscribed to. Allowing the same [grantee](https://salable.app/docs/core-concepts#grantee) to record usage for two different owners at two distinct rates.
- **Two users, two tenants.** Use _Viewing as_ in the top-right corner to change which user you view the app as (Alice or Bob). Then change the tenant you view the app as via the team dropdown in the top-left corner (Personal or Team ACME). Each tenant is the [owner](https://salable.app/docs/core-concepts#owner) of a subscription. The pair selects which owner and [grantee](https://salable.app/docs/core-concepts#grantee) every Salable call is made for.
- **Automatic entitlements.** The product defines no entitlements. An owner-scoped [entitlement check](https://salable.app/docs/check-entitlements) automatically returns the plan's meter and token slugs as entitlements with `type: 'meter'` and `type: 'token'` respectively. So, _Export PDF_ is unlocked wherever the check returns the `pdf_exports` meter (both plans) and the _AI assistant_ wherever it returns the `ai_credits` token (Team only).
- **Recording usage.** Each export [records usage](https://salable.app/docs/recording-usage) for the workspace's owner with an `Idempotency-Key`. Salable answers immediately and increments the owner's usage asynchronously.
- **Consuming tokens.** Each summary [consumes tokens immediately](https://salable.app/docs/token-billing#consuming-tokens) for `team_acme`. If the user has an insufficient balance then the request rejects with  `422 Insufficient token balance` until the balance is sufficient again.
- **Usage and credits shared by the owner.** Everyone in the [group](https://salable.app/docs/grantee-groups) owned by Team ACME records exports on the same usage record and consumes tokens from the same balance.
- **Subscription management.** Turn auto-renew off and on, or cancel immediately, in either workspace. Cancelling Team locks the features for every member of the group at once.

> NOTE: To keep the code close to the guide, the grantees are hardcoded as `user_alice` and `user_bob`, the team's owner as `team_acme`, the meter as `pdf_exports`, the token as `ai_credits` and the per-seat line item slug as `hybrid_team_seats`. In the Personal workspace the owner is the user's own ID.

## Prerequisites

- **A Salable account.** Sign up at [salable.app](https://salable.app/auth/sign-in).
- **Node.js 22 or later and npm.**
- **This demo copied locally and installed dependencies.**

  ```bash
  npx degit Salable/examples/hybrid-pricing-quick-start-demo hybrid-pricing-quick-start-demo
  cd hybrid-pricing-quick-start-demo
  npm install
  ```

- **Create a `.env.local` file.** Duplicate `.env.example` and rename the copy to `.env.local`.

  ```bash
  cp .env.example .env.local
  ```

## Setup

1. **Add your Salable secret key.** In the Salable dashboard switch to **test mode**, open the [API keys page](https://salable.app/dashboard/api-keys), copy the secret key and paste it into `.env.local`:

   ```dotenv
   SALABLE_SECRET_KEY="sk_test_..."
   ```

   > NOTE: The secret key should never be used outside the server. Only use it inside API routes and `getServerSideProps`.

2. **Import the example product.** The repository contains a `product.yaml`, which describes the _Notes Hybrid_ product, its _Personal_ and _Team_ plans and their line items. Importing it also creates the `pdf_exports` meter and the `ai_credits` token in Salable and Stripe. Import it one of two ways:

   - **Script (recommended).** Run

     ```bash
     npm run import:salable-product
     ```

     It uploads `product.yaml` to Salable and logs the environment variables you need. Copy the printed lines into your `.env.local`.

   - **Dashboard.** Go to the [Products page](https://salable.app/dashboard/products), choose _Upload YAML_ and upload `product.yaml`. Then open each plan and copy its ID into `.env.local`:

     ```dotenv
     SALABLE_PERSONAL_PLAN_ID="plan_..."
     SALABLE_TEAM_PLAN_ID="plan_..."
     ```

3. **Start the app.**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Using the Demo

1. **Start from nothing.** When first opened, the page is viewing as Alice in her Personal workspace. Both features are locked and there is no subscription. The _Owner_, _Grantee_, _Meter_ and _Token_ chips show which IDs the entitlement check is made with and which slugs the features are gated on; switch user or workspace and watch the owner and grantee change.

2. **Subscribe to Personal.** Press _Subscribe to Personal_ with Alice selected. On Stripe's Checkout, enter any email address and pay with Stripe's test card `4242 4242 4242 4242` using any future expiry, CVC and cardholder name. Stripe shows the $9.00 flat fee and the metered line at $0.25 per export with nothing to pay for it yet.
   - Once returned to the demo, Export PDF is unlocked but the AI assistant stays locked: the check returned the `pdf_exports` meter but no `ai_credits` token, because the Personal plan has no token line item. The subscription is owned by `user_alice` and the usage panel shows a `current` record with a count of 0.

3. **Export some notes.** Enter 3 in _Notes to export_ and press _Export to PDF_. This increments the usage by 3 for the `pdf_exports` meter for `user_alice`. After a short delay the request is processed and the usage displays as 3 with the estimated charge at $0.75 using the Personal rate of $0.25.

4. **Subscribe to Team.** Pick _Team ACME_ from the workspace dropdown while still viewing as Alice. Both features are locked again, because the check is now scoped to the owner `team_acme`, which doesn't have a subscription. Press _Subscribe to Team_; Stripe shows 2 seats at $12.00 each, the $5.00 AI credits bundle and the metered line at $0.10 per export. Pay with the same test card details as before.
   - Once returned, both features are unlocked: the check for `team_acme` returns the meter and the token. The usage panel shows a separate record for `team_acme` with a count of 0, the _AI credit balance_ panel shows 100 `ai_credits`, and the _Team ACME members_ panel shows the group Salable created at checkout with Alice as its only member and _1 of 2 seats used_.

5. **Export at the Team rate.** Export 2 notes. This time the usage lands on `team_acme`'s record: the count is incremented to 2 and the estimated charge reads $0.20, because the Team plan's line item bills the same meter at $0.10. This is separate to Alice's Personal usage consumption of 3, costing $0.75.

6. **Spend some credits.** Enter 10 in _Credits to spend_ and press _Summarise my notes_. The balance immediately drops to 90 as consumption is synchronous. If you switch to Alice's Personal workspace, the AI assistant is still locked as the Personal plan has no `ai_credits` to grant access.

7. **Add Bob and share the meter.** Back in Team ACME, press _Add Bob Johnson_ in the members panel and the badge changes to _2 of 2 seats used_. Switch _Viewing as_ to Bob and both features are unlocked for him through his membership to the group, allowing Bob to see the same usage, balance and members panels as Alice without needing to checkout again. Export a single note as Bob and the team's count rises to 3 and the estimated cost increases to $0.30. If you switch to his Personal workspace, both features are locked again because Bob has no Personal subscription.

8. **Remove Bob.** Switch back to Alice in the Team ACME workspace and press _Remove_ on Bob's row. The seat is freed and, viewing as Bob again, the Team ACME workspace is locked: the features are gated and the subscription, usage, balance and members panels are replaced by a _Not a member_ notice.

9. **Run the credits out.** As Alice in Team ACME, spend 100 credits. Salable lets this one request overrun the balance, so it succeeds and the balance panel shows -10. Spend 1 more credit and the request is rejected with _Insufficient token balance_; nothing is deducted.

10. **Subscription management.** When viewing as Alice, use the Manage panel to _Turn off auto-renew_. The badge changes to _Cancels at period end_ and the button flips to _Turn on auto-renew_; press it again to restore.

11. **Cancel Team.** Press _Cancel subscription_ in the Manage Team panel and confirm. Once Stripe confirms, the meter and token drop out of the check for every member, both features lock in the Team ACME workspace for all members, the team's usage record changes from `current` to `final` with the count that will be invoiced, and the members panel reports no group. Alice's Personal subscription, access, and usage are unaffected.

12. **Reset and go again.** Press _Reset demo_ at the bottom and confirm. This removes all of the data created in the demo apart from the imported product and plans; the usage records and token balances go with their owners.

## Troubleshooting

- **"Salable could not be reached" on load.** `SALABLE_SECRET_KEY`, `SALABLE_PERSONAL_PLAN_ID` or `SALABLE_TEAM_PLAN_ID` is missing from `.env.local`. Check the values and restart `npm run dev`.
- **Nothing changes after checkout.** Press _Refresh_ after a moment to refetch the data from Salable.
- **The usage count has not moved after an export.** Salable records usage asynchronously and a queued increment can take around half a minute to appear. The page polls for 40 seconds after each export; press _Refresh_ if it still lags.
- **Exporting fails with "Salable has no usage record".** The subscription has just been created and its usage record is not there yet. Wait a moment and press _Refresh_.
- **Checkout fails with "This owner is already subscribed to metered plan items with these slugs".** An owner can only hold one live subscription to a given meter. Cancel the existing subscription for that owner, or _Reset demo_, before subscribing again. Personal and Team never collide because their owners differ.
- **The import fails with "The provided line item slugs are in use".** Line item slugs are unique across your organisation. Another product already uses one of this demo's slugs; rename them in `product.yaml` (and `TEAM_SEATS_SLUG` in `lib/constants.ts` for the per-seat one) or delete the other product in the dashboard.
- **Adding a member fails with "This group has reached its maximum number of grantees".** Every seat is taken. Remove a member first; the demo buys 2 seats and never changes the quantity. In your own app, raise the seat count with the [manage seats](https://salable.app/docs/manage-seats) endpoint before adding more members.
- **The members panel says there is no group even though Team is subscribed.** Salable creates the group when the subscription is created, a moment after checkout. Press _Refresh_ after a few seconds.
- **The dashboard lists more than one group for `team_acme`.** Every Team checkout creates a new group, so cancelling and subscribing again leaves the old group behind. The demo always follows the live subscription's group, and _Reset demo_ deletes them all.
- **Subscriptions, usage or members you did not create appear.** The [per-seat demo](../per-seat-quick-start-demo) uses the same `user_alice`, `user_bob` and `team_acme` IDs, so running both in one Salable organisation shows each other's subscriptions and _Reset demo_ in either deletes both demos' data. The [usage](../usage-quick-start-demo) and [token](../token-quick-start-demo) demos share the `user_alice` grantee, and their _Reset demo_ deletes that grantee record and with it her memberships in this demo's groups.
- **The Team ACME workspace only says "Not a member".** The user you are viewing as is not in the group behind the live Team subscription, so the server withholds its details. Switch to a member and add them. In your own app the acting user would come from the session; the demo passes it in the request because you pick who to view as.

## Further Reading

- [Hybrid pricing quick start guide](https://salable.app/docs/hybrid-pricing-quick-start), the guide this repository follows step by step
- [Per-seat billing quick start guide](https://salable.app/docs/per-seat-quick-start), explore per-seat billing in more depth
- [Usage billing quick start guide](https://salable.app/docs/usage-quick-start), explore usage billing in more depth
- [Token billing quick start guide](https://salable.app/docs/token-quick-start), explore token billing in more depth
- [Combining multiple line items](https://salable.app/docs/products-and-pricing#combining-multiple-line-items), how flat-rate, per-seat, metered and token charges mix on one plan
- [Metered usage](https://salable.app/docs/metered-usage), how usage records are aggregated and billed at the end of each period
- [Recording usage](https://salable.app/docs/recording-usage), the call behind each export and its idempotency key
- [Token billing](https://salable.app/docs/token-billing), reset versus accumulate behaviour, expiry and webhooks
- [Grantees and groups](https://salable.app/docs/grantee-groups), how owners, groups, memberships and seats fit together
- [Manage seats](https://salable.app/docs/manage-seats), adding, removing and replacing members and changing the seat count
- [Quick checkout](https://salable.app/docs/quick-checkout), creating checkout links without needing to manage a cart
- [Checking entitlements](https://salable.app/docs/check-entitlements), the owner-scoped call that returns the meter and token both features gate on
- [Cancelling a subscription](https://salable.app/docs/cancel-subscription), immediate cancel versus auto-renew
- [Salable Node SDK](https://github.com/Salable/sdk)
