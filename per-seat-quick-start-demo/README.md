# Salable Per-Seat Quick Start

A simple demo following the [Salable Per-Seat Billing Quick Start](https://salable.app/docs/per-seat-quick-start). The guide explains how to charge a team per seat, onboard its members through a group and gate features with Salable; this repository lets you follow the guide and see it in action, then goes a little further to show the same user holding different access on a personal and a team subscription.

## What's included?

- **Selling a flat-rate plan and a per-seat plan.** A monthly _Personal_ subscription at $9.00 and a monthly _Team_ subscription at $12.00 per seat with a [per-seat line item](https://salable.app/docs/products-and-pricing#line-item-types) capped at 2 seats. Personal unlocks the `export_pdf` [entitlement](https://salable.app/docs/core-concepts#entitlement); Team unlocks `export_pdf` and `ai_assistant`.
- **Two users, two tabs.** View the app as Alice or Bob and switch between their _Personal_ tab, where the user is their own [owner](https://salable.app/docs/core-concepts#owner), and the _Team ACME_ tab, owned by `team_acme`. The pair selects which owner and [grantee](https://salable.app/docs/core-concepts#grantee) every Salable call is made for.
- **Groups created at checkout.** Team checkout passes the buyer's grantee ID with 2 seats in `metadata`, so Salable creates a [group](https://salable.app/docs/grantee-groups) owned by `team_acme` with the buyer as its first member and two seats to fill.
- **Feature gating.** Two simulated features, _Export PDF_ and _AI assistant_, are locked until an [owner-scoped entitlement check](https://salable.app/docs/check-entitlements) for the current user and tab returns their entitlement. The same user is locked out of the AI assistant on their Personal tab and let in on Team ACME.
- **Adding and removing members.** Once the Team subscription is live, a member can add the other user to the group, granting them the Team plan's entitlements straight away with no checkout, or remove a member to free the seat. Salable rejects an add that would exceed the seat count.
- **Membership as authorisation.** Being in the group is what lets a user see and manage the team's subscription as well as access the features the subscription grants. Users outside the group will appear as unsubscribed.
- **Managing the subscriptions.** Turn auto-renew off and on, or cancel immediately, on either tab. Cancelling Team locks the features for every member of the group at once.

> NOTE: To keep the code close to the guide, the grantees are hardcoded as `user_alice` and `user_bob`, the team's owner as `team_acme`, the per-seat line item as `team_seats` and the entitlements as `export_pdf` and `ai_assistant`. On the Personal tab the owner is the user's own ID.

## Prerequisites

- **A Salable account.** Sign up at [salable.app](https://salable.app/auth/sign-in).
- **Node.js 22 or later and npm.**
- **This demo copied locally and installed dependencies.**

  ```bash
  npx degit Salable/examples/per-seat-quick-start-demo per-seat-quick-start-demo
  cd per-seat-quick-start-demo
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

2. **Import the example product.** The repository contains a `product.yaml`, which describes the _Notes_ product, its _Personal_ and _Team_ plans and the `team_seats` per-seat line item. Import it one of two ways:

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

1. **Start from nothing.** When first opened, the page is viewing as Alice on her Personal tab. Both features are locked and there is no subscription. The _Owner_ and _Grantee_ chips show which IDs the entitlement check is made with; switch user or tab and watch them change.

2. **Subscribe to Personal.** Press _Subscribe to Personal_ with Alice selected. On Stripe's Checkout, enter any email address and pay with Stripe's test card `4242 4242 4242 4242` using any future expiry, CVC and cardholder name.
   - Once returned to the demo, Export PDF is unlocked but the AI assistant stays locked: the Personal plan only grants `export_pdf`. The subscription is owned by `user_alice`.

3. **Subscribe to Team.** Switch to the _Team ACME_ tab while still viewing as Alice. Both features are locked again, because the check is now scoped to owner `team_acme`, which is not currently subscribed. Press _Subscribe to Team_; Stripe shows 2 seats at $12.00 each. Pay with the same test card details as before.
   - Once returned, both features are unlocked. The _Team ACME members_ panel shows the group Salable created at checkout, with Alice as its only member and _1 of 2 seats used_.

4. **Add Bob.** In the members panel press _Add Bob Johnson_. Bob joins the group and the badge changes to _2 of 2 seats used_. No checkout is required as the seat was already paid for, it was just allocated to Bob.

5. **View as Bob.** Switch _Viewing as_ to Bob. On the Team ACME tab both features are unlocked for him through his membership of the group, and he sees the same Manage Team and members panels as Alice. Switch to his Personal tab and both features are locked because Bob has no Personal subscription of his own.

6. **Remove Bob.** Switch back to Alice's Team ACME tab and press _Remove_ on Bob's row. The seat is freed and, viewing as Bob again, the Team ACME tab is locked: the features are gated, the subscription and members panels are replaced by a _Not a member_ notice.

7. **Manage a subscription.** When viewing as Alice, use the Manage panel to _Turn off auto-renew_. The badge changes to _Cancels at period end_ and the button flips to _Turn on auto-renew_; press it again to restore.

8. **Cancel Team.** Press _Cancel subscription_ in the Manage Team panel and confirm. Once Stripe confirms, the entitlements drop out of the check for every member, both features lock on the Team ACME tab for Alice and Bob alike, and the members panel reports no group. Alice's Personal subscription is unaffected.

9. **Reset and go again.** Press _Reset demo_ at the bottom and confirm. This removes all of the data created in the demo apart from the imported product and plans.

## Troubleshooting

- **"Salable could not be reached" on load.** `SALABLE_SECRET_KEY`, `SALABLE_PERSONAL_PLAN_ID` or `SALABLE_TEAM_PLAN_ID` is missing from `.env.local`. Check the values and restart `npm run dev`.
- **Nothing changes after checkout.** Press _Refresh_ after a moment to refetch the data from Salable.
- **Adding a member fails with "This group has reached its maximum number of grantees".** Every seat is taken. Remove a member first; the demo buys 2 seats and never changes the quantity. In your own app, raise the seat count with the [manage seats](https://salable.app/docs/manage-seats) endpoint before adding more members.
- **The members panel says there is no group even though Team is subscribed.** Salable creates the group when the subscription is created, a moment after checkout. Press _Refresh_ after a few seconds.
- **The dashboard lists more than one group for `team_acme`.** Every Team checkout creates a new group, so cancelling and subscribing again leaves the old group behind. The demo always follows the live subscription's group, and _Reset demo_ deletes them all.
- **Entitlements or subscriptions you did not buy appear.** The [usage](../usage-quick-start-demo) and [token](../token-quick-start-demo) quick start demos use the same `user_alice` grantee. Running them in the same Salable organisation does not mix subscriptions, because the owners differ, but _Reset demo_ in any of them deletes the `user_alice` grantee record and with it her memberships in this demo's groups.
- **The Team ACME tab only says "Not a member".** The user you are viewing as is not in the group behind the live Team subscription, so the server withholds its details. Switch to a member and add them. In your own app the acting user would come from the session; the demo passes it in the request because you pick who to view as.

## Further Reading

- [Per-seat billing quick start guide](https://salable.app/docs/per-seat-quick-start), the guide this repository follows step by step
- [Hybrid pricing quick start guide](https://salable.app/docs/hybrid-pricing-quick-start), combine token, metered, per-seat and flat-rate on the same subscription
- [Grantees and groups](https://salable.app/docs/grantee-groups), how owners, groups, memberships and seats fit together
- [Manage seats](https://salable.app/docs/manage-seats), adding, removing and replacing members and changing the seat count
- [Quick checkout](https://salable.app/docs/quick-checkout), every field accepted by `checkout.post`, including `metadata` for seat quantities
- [Checking entitlements](https://salable.app/docs/check-entitlements), the owner-scoped call that gates both features
- [Cancelling a subscription](https://salable.app/docs/cancel-subscription), immediate cancel versus auto-renew
- [Salable Node SDK](https://github.com/Salable/sdk)
