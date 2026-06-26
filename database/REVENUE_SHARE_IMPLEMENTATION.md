# Charging Revenue Share — Implementation

How a charging payment is split between **DJT (platform)** and the **station vendor
(owner)**, end‑to‑end, with in‑sync wallets and transaction histories.

> Status: implemented & tested end‑to‑end over HTTP (start → consume → stop).
> Builds on the double‑entry ledger (see `PAYMENT_LEDGER_DESIGN.md`).

---

## 1. The rule (configurable percentage)

- The split is a **percentage**, stored in **`cmsn_rule_lst_t`**, and is fully
  configurable — change it any time and future charges use the new value.
- DJT keeps `platfrm_pct`%, the vendor keeps `ownr_pct`% (must sum to 100).
- Default: **DJT 14.58% / vendor 85.42%** (derived from the “₹3.5 per unit at
  ₹24/unit” example: 3.5 ÷ 24 = 14.58%). Because it is a percentage of the total,
  DJT’s per‑unit cut scales with the unit price.
- Resolution order (most specific wins, effective‑dated): **station → owner → global**.

### Configure

```bash
# global default — DJT 14.58% / vendor 85.42%
node database/set_commission_share.js 14.58

# owner-specific override (owner usr_id 13 keeps DJT at 12%)
node database/set_commission_share.js 12 owner 13

# station-specific override (station 12)
node database/set_commission_share.js 10 station 12
```

Script: `database/set_commission_share.js` (deactivates the prior active rule for
that scope, inserts a fresh effective‑dated rule; newest active rule wins).

---

## 2. Money flow

The charge is routed through the ledger so every movement is double‑entry,
balanced, idempotent, and mirrored to the legacy wallets.

### Pay / start  → `ledgerService.chargingHold`
`sessionCtrl.startSession` (`POST /api/sessions/start`)

```
DEBIT  WALLET_<customer>     (prepaid = selected_units × price)
CREDIT ESCROW_HOLD
```

### Stop  → `ledgerService.chargingSettle`
`sessionCtrl.stopSession` (`POST /api/sessions/stop`)

```
payment journal:  DEBIT ESCROW_HOLD (consumed)
                  CREDIT OWNER_<vendor>      (consumed × ownr_pct%)
                  CREDIT PLATFORM_REVENUE    (consumed × platfrm_pct%)

refund journal:   DEBIT ESCROW_HOLD (unused)
                  CREDIT WALLET_<customer>   (prepaid − consumed)   [if any]
```

- `consumed` is capped at the prepaid hold (never settle more than held).
- Split is integer‑paise with a largest‑remainder rule (platform absorbs the
  rounding) so **owner + platform == consumed exactly**.

---

## 3. Tables touched per charge

| Table | Role in the split |
|---|---|
| `cmsn_rule_lst_t` | the configured share % (DJT vs vendor), resolved per charge |
| `acct_lst_t` | ledger account balances: `WALLET_<cust>`, `OWNER_<vendor>`, `PLATFORM_REVENUE`, `ESCROW_HOLD` |
| `jrnl_lst_t` / `jrnl_leg_lst_t` | double‑entry journal headers + legs (the authoritative history) |
| `wllt_lst_t` | legacy wallet balances — **customer AND vendor** (mirrored) |
| `trxn_lst_t` | legacy per‑user transaction history — customer (hold/refund) + **vendor (earnings)** |
| `audt_lst_t` | audit rows: `charging_hold`, `charging_payment`, `charging_refund`, `session_start`, `session_stop`, `session_payment` |
| `sssn_lst_t` | session row (status, energy, cost) |

---

## 4. Code changes

| File | Change |
|---|---|
| `api/modules/sessions/controllers/sessionCtrl.js` | `startSession` → `chargingHold`; `stopSession` → `chargingSettle` (split + refund) |
| `api/modules/ledger/services/ledgerService.js` | `postJournal` also mirrors `owner_earnings` credits to the vendor’s `wllt_lst_t` + `trxn_lst_t` |
| `database/set_commission_share.js` | configure the (percentage) split — global / owner / station |

Reused as‑is from the ledger: `chargingHold`, `chargingSettle`,
`resolveCommissionRule`, `splitConsumed`, `postJournal`.

---

## 5. Verified result (live HTTP test)

Start (pay for 10 units @ ₹24 = **₹240**) → consume **8.5** units (**₹204**) → stop:

```
consumed ₹204  ->  vendor ₹174.25  +  DJT ₹29.75   (= ₹204 exact)
refund to customer (unused) ₹36
```

| Table | Recorded |
|---|---|
| acct_lst_t | WALLET_cust ₹796, OWNER_vendor ₹174.25, PLATFORM_REVENUE +₹29.75, ESCROW_HOLD net 0 |
| wllt_lst_t | customer ₹796, **vendor ₹174.25** |
| trxn_lst_t | customer: topup, charging‑hold debit, refund credit; vendor: earnings credit ₹174.25 |
| jrnl_lst_t/leg | `charging_hold` ₹240, `charging_payment` ₹204 (→ OWNER ₹174.25 + PLATFORM ₹29.75), `charging_refund` ₹36 — all balanced |
| audt_lst_t | charging_hold, session_start, session_payment, charging_payment, session_stop |

All test entities and balances were cleaned up after the run.

---

## 6. Deployment

1. Pull latest + restart the API on the server.
2. On a fresh environment, set the split once: `node database/set_commission_share.js 14.58`
   (requires the ledger tables from `migrations/2026_06_payment_ledger.sql`).

---

## 7. Prerequisites & caveats

- **Wallets must be ledger‑backed.** `chargingHold` debits the ledger
  `WALLET_<user>` account. Top‑ups via the Razorpay `/payment/verify` flow already
  post through the ledger, so real users’ ledger and legacy wallets are in sync.
  If a wallet was funded only via a legacy path, run `database/reconcile_wallet_balances.js`.
- **DJT’s “wallet”** is the system account `PLATFORM_REVENUE` (there is no DJT user);
  its history is the journal legs.
- **Scope of this change = the in‑app charging flow** (`/api/sessions/start|stop`).
  The **OCPP real‑charger** path (`api/ocpp/ocppHandlers.js` `settleWallet`) still
  deducts the wallet directly and does **not** apply the split yet — and that field
  charger is OCPP 1.6 while the server is 2.0.1 (see OCPP diagnostics). Routing OCPP
  settlement through `chargingSettle` is the remaining step to make real‑charger
  charges revenue‑shared.
