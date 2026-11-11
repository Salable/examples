# Salable Hybrid Pricing Quick Start

A simple demo following the [Salable Hybrid Pricing Quick Start](https://salable.app/docs/hybrid-pricing-quick-start). The guide explains how to combine flat-rate, per-seat, metered and token line items on one subscription and gate features on what an owner-scoped entitlement check returns; this repository lets you follow the guide and see it in action, then goes a little further to show two plans metering the same slug at different rates and the same user holding different access on a personal and a team subscription.

## What's included?

- **Selling two plans that each combine pricing types.** A monthly _Personal_ subscription with a $9.00 [flat-rate line item](https://salable.app/docs/products-and-pricing#line-item-types) plus a [metered line item](https://salable.app/docs/metered-usage) at $0.25 per PDF export, and a monthly _Team_ subscription with a [per-seat line item](https://salable.app/docs/products-and-pricing#line-item-types) at $12.00 per seat capped at 2 seats, a metered line item at $0.10 per PDF export and a [recurring token line item](https://salable.app/docs/token-billing) of 100 `ai_credits` for $5.00. See [combining multiple line items](https://salable.app/docs/products-and-pricing#combining-multiple-line-items).
- **The same meter at two rates.** Both metered line items use the `pdf_exports` [meter](https://salable.app/docs/core-concepts#meter-slug). Usage is recorded per [owner](https://salable.app/docs/core-concepts#owner), so which rate applies depends only on whose subscription the usage lands on: Alice's Personal exports bill `user_alice` at $0.25, the team's exports bill `team_acme` at $0.10.
- **Two users, two workspaces.** Use _Viewing as_ in the top-right corner to view the app as Alice or Bob, and the team dropdown in the top-left corner to switch between their _Personal_ workspace, where the user is their own owner, and the _Team ACME_ workspace, owned by `team_acme`. The pair selects which owner and [grantee](https://salable.app/docs/core-concepts#grantee) every Salable call is made for.
- **Feature gating on line items, not entitlements.** The product defines no entitlements. An [owner-scoped entitlement check](https://salable.app/docs/check-entitlements) returns the plan's meter and token slugs as entries with `type: 'meter'` and `type: 'token'`, so _Export PDF_ is unlocked wherever the check returns the `pdf_exports` meter (both plans) and the _AI assistant_ wherever it returns the `ai_credits` token (Team only). The same user is locked out of the AI assistant in their Personal workspace and let in on Team ACME.
- **Recording usage.** Each export calls [`usage.record.post`](https://salable.app/docs/record-usage) for the workspace's owner with an `Idempotency-Key`. Salable answers immediately and increments the owner's current usage record in the background, so the page polls for a while after each export.
- **Consuming tokens.** Each summary calls `tokens.consume.post` for `team_acme`. Consuming is synchronous: the balance drops at once. Salable lets one request overrun the balance, then rejects every consume with `422 Insufficient token balance` until the next cycle resets the allowance.
- **Usage and credits shared by the team.** Everyone in the Team ACME [group](https://salable.app/docs/grantee-groups) records exports on the team's one usage record and spends from the team's one credit balance. A member can add the other user to the group, giving them that access straight away with no checkout, or remove a member to free the seat and take it away.
- **Viewing usage and balances.** The _Export usage this period_ panel lists the owner's usage records for the meter with the count, the rate for the current plan and the estimated charge; the _AI credit balance_ panel in the Team ACME workspace lists the token records behind the balance.
- **Managing the subscriptions.** Turn auto-renew off and on, or cancel immediately, in either workspace. Cancelling finalises the usage record for the period and locks the features for every member of the group at once.

> NOTE: To keep the code close to the guide, the grantees are hardcoded as `user_alice` and `user_bob`, the team's owner as `team_acme`, the meter as `pdf_exports`, the token as `ai_credits` and the per-seat line item as `hybrid_team_seats`. In the Personal workspace the owner is the user's own ID. Line item slugs are unique across a Salable organisation, which is why this demo's slugs carry a `hybrid_` prefix: they can be imported alongside the [per-seat demo](../per-seat-quick-start-demo)'s product.

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

1. **Start from nothing.** When first opened, the page is viewing as Alice in her Personal workspace. Both features are locked and there is no subscription. The _Owner_, _Grantee_, _Meter_ and _Token_ chips show which IDs the entitlement check is made with and which slugs the features are gated on; switch user or workspace and watch the owner change.

2. **Subscribe to Personal.** Press _Subscribe to Personal_ with Alice selected. On Stripe's Checkout, enter any email address and pay with Stripe's test card `4242 4242 4242 4242` using any future expiry, CVC and cardholder name. Stripe shows the $9.00 flat fee and the metered line at $0.25 per export with nothing to pay for it yet.
   - Once returned to the demo, Export PDF is unlocked but the AI assistant stays locked: the check returned the `pdf_exports` meter but no `ai_credits` token, because the Personal plan has no token line item. The subscription is owned by `user_alice` and the usage panel shows a `current` record with a count of 0.

3. **Export some notes.** Enter 2 in _Notes to export_ and press _Export to PDF_. The route records 2 against the `pdf_exports` meter for `user_alice`. Within about half a minute the count reaches 2 and the estimated charge reads $0.50 at the Personal rate.

4. **Subscribe to Team.** Pick _Team ACME_ from the team dropdown while still viewing as Alice. Both features are locked again, because the check is now scoped to owner `team_acme`, which is not currently subscribed. Press _Subscribe to Team_; Stripe shows 2 seats at $12.00 each, the $5.00 AI credits bundle and the metered line at $0.10 per export. Pay with the same test card details as before.
   - Once returned, both features are unlocked: the check for `team_acme` returns the meter and the token. The usage panel shows a separate record for `team_acme` with a count of 0, the _AI credit balance_ panel shows 100 `ai_credits`, and the _Team ACME members_ panel shows the group Salable created at checkout with Alice as its only member and _1 of 2 seats used_.

5. **Export at the Team rate.** Export 2 notes again. This time the usage lands on `team_acme`'s record: the count reaches 2 and the estimated charge reads $0.20, because the Team plan's line item bills the same meter at $0.10. Alice's Personal record still shows 2.

6. **Spend some credits.** Enter 10 in _Credits to spend_ and press _Summarise my notes_. The balance drops to 90 at once; consuming is synchronous. Switch to Alice's Personal workspace and the AI assistant is locked: the Personal plan has no `ai_credits`.

7. **Add Bob and share the meter.** Back in Team ACME, press _Add Bob Johnson_ in the members panel. The badge changes to _2 of 2 seats used_ with no checkout. Switch _Viewing as_ to Bob: both features are unlocked for him through his membership, and he sees the same usage, balance and members panels as Alice. Export a note as Bob and the team's count rises to 3: every member's usage pools on the team's one record. Switch to his Personal workspace and both features are locked because Bob has no Personal subscription of his own.

8. **Remove Bob.** Switch back to Alice in the Team ACME workspace and press _Remove_ on Bob's row. The seat is freed and, viewing as Bob again, the Team ACME workspace is locked: the features are gated and the subscription, usage, balance and members panels are replaced by a _Not a member_ notice.

9. **Run the credits out.** As Alice in Team ACME, spend 100 credits. Salable lets this one request overrun the balance, so it succeeds and the balance panel shows -10. Spend 1 more and the request is rejected with _Insufficient token balance_; nothing is deducted. The balance resets to 100 when the next cycle starts.

10. **Manage a subscription.** When viewing as Alice, use the Manage panel to _Turn off auto-renew_. The badge changes to _Cancels at period end_ and the button flips to _Turn on auto-renew_; press it again to restore.

11. **Cancel Team.** Press _Cancel subscription_ in the Manage Team panel and confirm. Once Stripe confirms, the meter and token drop out of the check for every member, both features lock in the Team ACME workspace for Alice and Bob alike, the team's usage record changes from `current` to `final` with the count that will be invoiced, and the members panel reports no group. Alice's Personal subscription and usage are unaffected.

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
- [Combining multiple line items](https://salable.app/docs/products-and-pricing#combining-multiple-line-items), how flat-rate, per-seat, metered and token charges mix on one plan
- [Metered usage](https://salable.app/docs/metered-usage), how usage records are aggregated and billed at the end of each period
- [Recording usage](https://salable.app/docs/record-usage), the call behind each export and its idempotency key
- [Token billing](https://salable.app/docs/token-billing), reset versus accumulate behaviour, expiry and webhooks
- [Grantees and groups](https://salable.app/docs/grantee-groups), how owners, groups, memberships and seats fit together
- [Manage seats](https://salable.app/docs/manage-seats), adding, removing and replacing members and changing the seat count
- [Quick checkout](https://salable.app/docs/quick-checkout), every field accepted by `checkout.post`, including `metadata` for seat quantities
- [Checking entitlements](https://salable.app/docs/check-entitlements), the owner-scoped call that returns the meter and token both features gate on
- [Cancelling a subscription](https://salable.app/docs/cancel-subscription), immediate cancel versus auto-renew
- [Per-seat billing quick start guide](https://salable.app/docs/per-seat-quick-start), the demo this one is built on
- [Salable Node SDK](https://github.com/Salable/sdk)
