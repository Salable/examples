# Salable Examples

Self-contained demo apps showing how to build on [Salable](https://salable.app). Each directory is a standalone project with its own `README.md`, `package.json` and `product.yaml`, so you can copy one, install its dependencies and run it without anything else from this repository.

## Demos

| Demo | What it shows |
| --- | --- |
| [`token-quick-start-demo`](./token-quick-start-demo) | Sell a recurring token plan and a one-off top-up, consume tokens from the balance and gate the feature on the token returned by an owner-scoped entitlement check. Follows the [token quick start](https://salable.app/docs/token-quick-start). |
| [`usage-quick-start-demo`](./usage-quick-start-demo) | Sell a metered plan, record usage against a meter and gate the feature on the meter returned by an owner-scoped entitlement check. Follows the [usage-based billing quick start](https://salable.app/docs/usage-quick-start). |
| [`payg-token-overage-demo`](./payg-token-overage-demo) | A monthly token allowance with pay-as-you-go overage. Consumes tokens first, then records anything beyond the allowance as metered usage, combining the two models in one subscription. |

Each demo's README walks through the setup and a step-by-step tour of the app.

## Getting a single demo

Cloning this repository pulls down every demo. If you only want one, use [degit](https://github.com/Rich-Harris/degit) to copy that directory without the rest of the repository or its git history:

```bash
npx degit Salable/examples/<demo-directory> <demo-directory>
cd <demo-directory>
npm install
```

For example, to get the token quick start demo:

```bash
npx degit Salable/examples/token-quick-start-demo token-quick-start-demo
cd token-quick-start-demo
npm install
```

If you want all of the demos, cloning still works as normal:

```bash
git clone git@github.com:Salable/examples.git
```

## Prerequisites

Every demo needs the same things:

- **A Salable account.** Sign up at [salable.app](https://salable.app/auth/sign-in) and switch the dashboard to **test mode**.
- **Node.js 22 or later and npm.**

From there, follow the demo's own README: copy `.env.example` to `.env.local`, add your test mode secret key, import the demo's `product.yaml` with `npm run import:salable-product` and start the app with `npm run dev`.

## Running more than one demo

To keep the code identical to the guides, every demo hardcodes the [owner](https://salable.app/docs/core-concepts#owner) as `company_acme` and the [grantee](https://salable.app/docs/core-concepts#grantee) as `user_alice`. If you run more than one demo in the same Salable organisation, each will list the others' subscriptions and entitlements under that owner, and _Reset demo_ in any of them deletes the subscriptions created by all of them. Reset between demos, or use a separate test organisation for each, to keep them apart.
