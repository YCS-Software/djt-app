# Payment & Double-Entry Ledger — Design Document

**Status:** Design approved (plan only — no schema/code applied yet)
**Database:** `DJT_POWERTECH_DEV` @ `3.110.84.196` (MySQL)
**Scope:** Seamless payments (wallet / UPI / card) with per-transaction and per-account
audit history, and automatic revenue split between the **station owner** and the **DJT platform**.

---

## 1. Goal

When a citizen pays for charging, the money must be split between the charging-station
owner and DJT (by a configurable percentage), with a full, auditable trail that records
**from which account & amount → to which account(s) & amount(s)**.

Example — user pays ₹100 from wallet, 80/20 split:
- Debit user wallet ₹100
- Credit station-owner earnings ₹80
- Credit DJT platform revenue ₹20

This is **double-entry accounting**, and the design below adds a proper ledger to support it.

---

## 2. Current database state (as inspected)

22 tables exist. Payment-relevant ones today:

| Table | Role | Limitation |
|---|---|---|
| `wllt_lst_t` | One wallet per user (`usr_id` UNIQUE), `blnce_amt` | Only customers have balances |
| `trxn_lst_t` | Wallet ledger (`credit/debit/refund`, `blnce_bfr/aftr_amt`, `ref_id/ref_typ_cd`) | **Single-entry, wallet-centric** — one row = one wallet; cannot express a one-to-many split |
| `pay_ordr_lst_t` | Razorpay orders (`created/paid/failed`, `is_mock_in`, `trxn_id`) | Only `purpose='wallet_topup'` |
| `sttn_lst_t` | Stations — has `ownr_usr_id` (owner FK, NULL = platform-owned) + `prce_per_kwh_amt` | Owner already modelled ✅ |
| `sssn_lst_t` | Sessions — `ttl_cst_amt`, `pymnt_sttus_cd`, `wllt_trxn_id` | Links to one debit txn only |
| `usr_lst_t` | Users — `usr_typ_cd` = customer/owner/admin/operator | Owners are users ✅ |
| `sttng_lst_t` | Key/value settings | No commission config |
| `audt_lst_t` | Generic audit (`actn_cd`, `entty_*`, old/new JSON, ip, UA) | Reusable ✅ |

**Gaps:** no multi-party/double-entry ledger, no owner/platform balance accounts, no
commission rules, no settlement/payout, no webhook log, no idempotency.

---

## 3. Core design decision: add a double-entry ledger

Add a ledger as the **single source of truth for all balances**, while keeping
`wllt_lst_t.blnce_amt` and `trxn_lst_t` as a **cache + customer-facing statement** so the
existing wallet UI keeps working with zero disruption.

Three concepts:
- **Account** (`acct_lst_t`) — any party that holds money: each customer wallet, each
  station-owner's earnings, DJT platform revenue, the Razorpay clearing account, an escrow/hold account.
- **Journal entry** (`jrnl_lst_t`) — one business event ("charging payment for session 42").
- **Journal legs** (`jrnl_leg_lst_t`) — the debit/credit lines.
  **Invariant: per entry, Σ debits = Σ credits.**

---

## 4. Approved design decisions

1. **Split timing → Escrow hold, settle at stop.**
   Session start posts `charging_hold` (wallet → `ESCROW_HOLD`). Session stop posts
   `charging_payment` (escrow → owner + DJT on the *consumed* amount) + `charging_refund`
   (escrow → wallet for the *unused* amount). Cancellation refunds the full hold.

2. **Direct UPI/card → Auto top-up then charge.**
   Any non-wallet payment first credits the wallet (`wallet_topup`), then the charge debits
   the wallet. Single split code path — splits always originate from the wallet.

3. **Commission → `cmsn_rule_lst_t`, per-station overridable.**
   Global default (e.g. 80/20) with per-station and per-owner overrides, effective-dated.
   Resolution order: **station → owner → global**. Validation enforces
   `ownr_pct + platfrm_pct = 100`.

---

## 5. New tables (project naming convention)

### 5.1 `acct_lst_t` — ledger accounts
```
acct_id PK | acct_cd UNIQUE (e.g. WALLET_12, OWNER_5, PLATFORM_REVENUE, GATEWAY_RZP, ESCROW_HOLD)
acct_typ_cd ('customer_wallet','owner_earnings','platform_revenue','gateway_clearing','escrow_hold','refund_payable')
ownr_usr_id FK usr_lst_t NULL | sttn_id FK sttn_lst_t NULL
crncy_cd ('INR') | blnce_amt decimal(12,2)   -- cached, recomputable from legs
is_systm_in tinyint | a_in | i_ts | u_ts
```

### 5.2 `jrnl_lst_t` — journal entries (transaction headers)
```
jrnl_id PK | jrnl_cd UNIQUE
jrnl_typ_cd ('wallet_topup','charging_hold','charging_payment','charging_refund','payout','reversal','adjustment')
ref_typ_cd ('session','pay_order','settlement','manual') | ref_id int
ttl_amt decimal(12,2) | crncy_cd
sttus_cd ('pending','posted','reversed','failed')
rvrsl_of_jrnl_id FK self NULL            -- reversals never mutate originals
idmpncy_ky_tx UNIQUE                      -- dedup retries/webhooks
dscrptn_tx | mtdata_json | insrt_usr_id | a_in | i_ts | u_ts
```

### 5.3 `jrnl_leg_lst_t` — postings (the from/to lines)
```
leg_id PK | jrnl_id FK | acct_id FK
drct_cd ('debit'|'credit') | amt decimal(12,2)
blnce_aftr_amt decimal(12,2)             -- per-account running balance → per-account history
memo_tx | i_ts
```

### 5.4 `cmsn_rule_lst_t` — commission / split rules (effective-dated, overridable)
```
rule_id PK | scope_cd ('global'|'station'|'owner')
sttn_id FK NULL | ownr_usr_id FK NULL
ownr_pct decimal(5,2) | platfrm_pct decimal(5,2) | tax_pct decimal(5,2) default 0
eff_frm_ts | eff_to_ts NULL | prirty_nbr | a_in | i_ts | u_ts
-- resolution: station > owner > global; validate ownr_pct + platfrm_pct = 100
```

### 5.5 `pay_wbhk_lst_t` — gateway webhook log (reliable async confirmation + reconciliation)
```
wbhk_id PK | evnt_id_tx UNIQUE | evnt_typ_tx ('payment.captured','payment.failed','refund.processed')
pay_ordr_id FK NULL | rzrpy_pymnt_id_tx | rzrpy_ordr_id_tx
sgntr_vld_in tinyint | prcsd_in tinyint | prcsd_ts | paylod_json | i_ts
```

### 5.6 `setlmnt_lst_t` — payouts to owners (T+n, when money leaves to bank)
```
setlmnt_id PK | ownr_usr_id FK | acct_id FK
prd_frm_dt | prd_to_dt | gross_amt | cmsn_amt | tax_amt | net_amt
sttus_cd ('pending','processing','paid','failed') | utr_tx | jrnl_id FK | i_ts | u_ts
```

### 5.7 Extend existing `pay_ordr_lst_t`
Add: `purpose_cd` → also `'charging_payment'`; `ref_typ_cd`, `ref_id` (link to session);
`jrnl_id` (link to posted entry).

> No separate refunds table — refunds are journals (`charging_refund`/`reversal`); gateway
> refund ids live on `pay_wbhk_lst_t` / `pay_ordr_lst_t`.

### 5.8 `pay_sttus_lst_t` — payment status master (lookup)
Reference table that defines the allowed payment/transaction status codes, so status values
are validated and centrally described instead of free-text strings scattered across tables.
```
pay_sttus_id PK
pay_sttus_cd UNIQUE   -- 'created','pending','paid','failed','cancelled','refunded','partially_refunded'
pay_sttus_nm_tx       -- display name (e.g. "Paid")
dscrptn_tx            -- meaning of the status
is_trmnl_in tinyint   -- 1 = terminal/final state (paid/failed/refunded), 0 = in-progress
srt_ordr_nbr          -- display ordering
a_in | i_ts | u_ts
```
Referenced by: `pay_ordr_lst_t.sttus_cd`, `trxn_lst_t.sttus_cd`, `jrnl_lst_t.sttus_cd`,
`setlmnt_lst_t.sttus_cd` → `pay_sttus_lst_t.pay_sttus_cd`.

### 5.9 `pay_mode_lst_t` — payment mode master (lookup)
Reference table for the payment methods a citizen can use.
```
pay_mode_id PK
pay_mode_cd UNIQUE    -- 'wallet','upi','card','netbanking'
pay_mode_nm_tx        -- display name (e.g. "UPI")
is_gtwy_in tinyint    -- 1 = goes through Razorpay (upi/card/netbanking), 0 = internal (wallet)
is_actv_in tinyint    -- enable/disable a mode without code changes
icon_tx               -- optional UI icon reference
srt_ordr_nbr          -- display ordering
a_in | i_ts | u_ts
```
Referenced by: `pay_ordr_lst_t.pymnt_mthd_cd`, `trxn_lst_t.pymnt_mthd_cd`
→ `pay_mode_lst_t.pay_mode_cd`.

> Both are seeded once with the values above. Keeping them as tables (vs hard-coded enums)
> lets ops add/disable a payment mode or describe a status without a code change, and gives
> the app a clean source for dropdowns.

---

## 6. Money flows (balanced)

Seed system accounts once: `GATEWAY_RZP`, `PLATFORM_REVENUE`, `ESCROW_HOLD`.
Auto-create `WALLET_<usr>` per customer and `OWNER_<usr>` per owner.

### A. Wallet top-up ₹500 (UPI/card via Razorpay) — journal `wallet_topup`
```
DEBIT  GATEWAY_RZP     500
CREDIT WALLET_<user>   500      (+ mirror to trxn_lst_t, update wllt cache)
```

### B. Charging — escrow at start, split at stop

Start (prepay ₹100) — journal `charging_hold`:
```
DEBIT  WALLET_<user>   100
CREDIT ESCROW_HOLD     100
```

Stop (consumed ₹70, 80/20 split) — journals `charging_payment` + `charging_refund`:
```
DEBIT  ESCROW_HOLD      70   |  DEBIT  ESCROW_HOLD     30
CREDIT OWNER_<owner>    56   |  CREDIT WALLET_<user>   30   (unused refund)
CREDIT PLATFORM_REVENUE 14   |
```

### C. "Pay directly via UPI/card" (no wallet)
Auto top-up (flow A) then charge (flow B). One split code path.

### D. Platform-owned station (`ownr_usr_id` NULL)
Owner share routes to `PLATFORM_REVENUE`.

### E. Owner payout
`payout` journal `DEBIT OWNER_<owner> / CREDIT GATEWAY_RZP(bank)` + `setlmnt_lst_t` row with UTR.

---

## 7. Edge cases the module must handle

1. **Insufficient balance** → reject before any posting.
2. **Concurrency / double-spend** → DB transaction with `SELECT … FOR UPDATE` on accounts
   (or atomic `UPDATE … WHERE balance >= amt`).
3. **Idempotency** → `jrnl.idmpncy_ky_tx` UNIQUE + `pay_wbhk.evnt_id_tx` UNIQUE.
4. **Invalid Razorpay signature** → reject, log with `sgntr_vld_in=0`.
5. **Captured at gateway but our write failed** → webhook + reconciliation job polls Razorpay
   for `created` orders and finishes them.
6. **Rounding** (80/20 of ₹99.99) → compute in paise, largest-remainder allocation, assert
   Σdebits = Σcredits exactly (no drift).
7. **Over-consumption** (metered > prepaid) → settle up to hold; charge remainder from wallet,
   or record a receivable if short.
8. **Refund failures** → stay `pending`, retry queue.
9. **Missing / != 100% commission rule** → validation + fall back to global default.
10. **Immutability** → never edit posted legs; corrections are reversing journals
    (`rvrsl_of_jrnl_id`).
11. **Atomicity** → all legs + cache updates + audit row in one DB transaction; rollback on failure.
12. **Integrity job** → nightly check `Σ legs.debit = Σ legs.credit` globally and
    `acct.blnce_amt = Σ its legs`.
13. **Audit** → write `audt_lst_t` (`actn_cd='payment'|'refund'|'payout'`, old/new JSON, ip, UA)
    for every movement.

---

## 8. Backend implementation plan (phased)

The core primitive everything calls:

```
postJournal({ type, refType, refId, idempotencyKey, legs[], actorUserId })
  → open DB txn → lock accounts → validate (balanced, sufficient funds)
  → insert jrnl + legs → update acct.blnce caches → mirror customer leg to trxn_lst_t
  → write audt_lst_t → commit (rollback on any error). Returns jrnl_id.
```

- **Phase 0 — Schema & seed.** Migration SQL for the 8 new tables + `pay_ordr_lst_t` alters.
  Seed the `pay_sttus_lst_t` and `pay_mode_lst_t` lookups, system accounts, and the default
  `cmsn_rule` (80/20). Backfill `acct_lst_t` from existing users/wallets; set cache balances.
  *(Note: `db.utils` blocks DDL — run via a migration runner or mysql client.)*
- **Phase 1 — Ledger core.** `acctMdl`, `jrnlMdl`, `commissionMdl` + `postJournal()` with
  tests (balanced, idempotent, locking, rounding).
- **Phase 2 — Wallet & top-up through ledger.** Route `wallet/add-money` + `payment/verify`
  through `postJournal`; add `POST /payment/webhook` (signature-verified, idempotent) +
  reconciliation job.
- **Phase 3 — Charging escrow.** Session start → `charging_hold`; stop → `charging_payment`
  + `charging_refund`; cancel → full refund. Resolve commission per station.
- **Phase 4 — Statements & admin.** `GET /ledger/accounts/:id/statement`,
  `GET /ledger/journals/:id`, commission CRUD.
- **Phase 5 — Settlements/payouts** (`setlmnt_lst_t`) — owner payout batches.

---

## 9. Open items / future

- Gateway fees (Razorpay MDR) — optional fee account/leg.
- GST/tax on commission — `tax_pct` already reserved on `cmsn_rule_lst_t`.
- Multi-currency — `crncy_cd` reserved throughout; INR-only for now.
- Storing amounts as integer paise (bigint) for exactness vs `decimal(12,2)` with explicit
  rounding rule (current choice).
