# Payment + Ledger — Playwright HTTP Simulation

End-to-end integration simulation that drives the **live Express server over HTTP**
(via Playwright's `request` API) to exercise the Razorpay payment flow and the
double-entry ledger, including the public webhook. Complements
`tests/payment/ledger.test.js`, which tests the ledger service in-process.

## No mock mode

The app has **no mock fallback**. `config/razorpay.config.js` exposes `isConfigured()`
(there is no `isMockMode`), and payments always go through the real Razorpay gateway.
Consequences for this simulation:

- `POST /api/payment/create-order` makes a **live** Razorpay API call. If the configured
  test keys are rejected it returns **502**. The script probes this endpoint **once** and
  merely **records** the outcome (`order_id` vs `502`) — a 502 is expected and is **not**
  a failure.
- Signature verification (`/payment/verify` and the webhook) is a **local HMAC** with the
  secret — it never calls Razorpay. So the verify + credit path is exercised
  **deterministically without a valid Razorpay account** by inserting a `pay_ordr_lst_t`
  row directly via the DB pool to **simulate the order** Razorpay would have created
  (status `created`, synthetic `rzrpy_ordr_id_tx` like `order_sim_<ts>`), then computing
  the signature `HMAC_SHA256(order_id + '|' + payment_id, RAZORPAY_SECRET_KEY)` and POSTing
  it to `/verify`.
- `/verify` requires **all three** of `razorpay_order_id`, `razorpay_payment_id`,
  `razorpay_signature` or returns 400.

## What it covers

0. **create-order probe** — call `/create-order` once; record whether it returns an
   `order_id` (keys accepted) or `502` (keys rejected). Record-only, never fails the run.
1. **Top-up (signed)** — simulate an order row, compute a valid signature, `verify` →
   `verified:true`, wallet balance rises by the amount, `/api/ledger/accounts` reflects it.
2. **Idempotent verify** — re-verifying the same order returns `already_processed:true`
   and does not double-credit.
3. **Invalid signature** — tampered signature → 400, not credited.
4. **Missing fields** — `/verify` without `payment_id` or without `signature` → 400.
5. **Webhook reconciliation** — a signed `payment.captured` webhook credits the wallet;
   replaying the same `x-razorpay-event-id` is a no-op; a bad signature → 401.
6. **Auth required** — protected endpoints with no/invalid token → 401.
7. **Ledger trail** — the created journal is balanced (Σdebit==Σcredit, via API and DB)
   and a matching `audt_lst_t` row exists.

The script self-creates an isolated test customer via the DB pool, mints its JWT
directly (no OTP), runs the scenarios, then **cleans up every row it inserts**
(including the simulated `pay_ordr_lst_t` rows and `pay_wbhk_lst_t` webhook rows) and
**restores the `GATEWAY_RZP` / `PLATFORM_REVENUE` / `ESCROW_HOLD` balances** to a
pre-test snapshot — leaving the shared DEV DB exactly as found.

## How to run

The server must be running on `:5000` **started with the same webhook secret** the
script signs with. From the repo root (Git Bash):

```sh
# 1. start the server with a known webhook secret (background)
RAZORPAY_WEBHOOK_SECRET=whsec_test node server.js > /tmp/djt_server.log 2>&1 &
#    wait until it logs "Server running on port 5000"

# 2. run the simulation (same secret, so webhook signatures match)
RAZORPAY_WEBHOOK_SECRET=whsec_test node tests/payment/playwright/payment.sim.js

# 3. stop the server you started
```

PowerShell equivalent for step 2: `$env:RAZORPAY_WEBHOOK_SECRET='whsec_test'; node tests/payment/playwright/payment.sim.js`

> Port 5000 must be free before step 1. If another `node` instance is already
> listening (without this webhook secret), stop it first — otherwise the server
> fails to bind (`EADDRINUSE`) and/or the webhook scenario cannot verify signatures.

Exit code is non-zero if any assertion fails.

### Environment

- `BASE_URL` (default `http://localhost:5000`)
- `RAZORPAY_WEBHOOK_SECRET` — **must match** the value the server was started with,
  or scenario 5 fails (the server rejects unverifiable webhooks). Pass it explicitly
  on both the server and the sim command; it overrides the `.env` value.
- App env from `.env`: `JWT_SECRET`, `RAZORPAY_SECRET_KEY`, DB credentials.

## Notes

- Uses the `playwright` package's request API (there is **no** `@playwright/test`).
- A `502` from `create-order` is the expected outcome with the current `.env` test keys
  (they fail Razorpay auth). The verify/credit/webhook paths are independent of that and
  are tested deterministically via simulated order rows + locally computed HMACs.

## Output

- `results/payment-sim-<timestamp>.log` — per-run log.
- `results/latest.log` — most recent run.
