# Payment / Ledger tests

Integration tests for the double-entry payment ledger
(`api/modules/ledger/**`). They run against the **DEV database** configured in
`config/db.config.js`, create their own isolated fixtures, and **clean up everything
they create** (including restoring the system-account balances).

## Run

```bash
# from the repo root
node tests/payment/ledger.test.js
# or
npm run test:payment
```

Exit code is `0` when all cases pass, non-zero otherwise (CI-friendly).

## Output

Every run writes a timestamped log plus a `latest.log` to:

```
tests/payment/results/
```

## Prerequisite (one-time)

The ledger tables must exist. Apply the migration first:

```bash
node database/run_payment_ledger_migration.js
# or
npm run migrate:ledger
```

## What is covered

| # | Case | Asserts |
|---|------|---------|
| 1 | Wallet top-up | gateway → wallet credit, journal balanced |
| 2 | Idempotency | same key does not double-credit |
| 3 | Charging hold | wallet → escrow |
| 4 | Insufficient funds | overdraw throws, balances unchanged |
| 5 | Partial settle + refund | 80/20 split, unused refunded, journals balanced |
| 6 | Full settle | no refund leg |
| 7 | Cancel hold | full refund |
| 8 | Rounding | owner + platform == total exactly |
| 9 | Per-station commission | station-scope override (70/30) wins |
| 10 | Double-entry shape | 1 debit (escrow) + 2 credits (owner, platform) |
| 11 | Owner payout | reduces owner balance; overdraw blocked |
| 12 | Legacy cache sync | `wllt_lst_t` + `trxn_lst_t` mirror the ledger |

Add new scenarios by appending to `runCases()` in `ledger.test.js`.
