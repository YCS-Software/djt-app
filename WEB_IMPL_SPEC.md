# WEB_IMPL_SPEC — djt-web Admin Console ↔ djt-app Backend Wiring

Master implementation spec for wiring the **djt-web** React admin console to the
**djt-app** Node/Express API against the live MySQL `*_lst_t` schema.

- Mount point: every entity router is mounted under **`/api/web`** by `api/routes/web/webRtr.js`.
- Auth: `webRtr.js` already applies `accessCtrl.verifyToken` + `accessCtrl.isAdmin` to the whole `/web` subtree. **Entity routers MUST NOT add auth.**
- Canonical pattern to copy: `api/modules/web/partners/{models/partnersMdl.js,controllers/partnersCtrl.js}` + `api/routes/web/partnersRtr.js`.
- `appRoot` is a GLOBAL. Model header is always:
  ```js
  const sqldb = require(appRoot + '/config/db.config');
  const dbutil = require(appRoot + '/utils/db.utils');
  const cntxtDtls = '<entity>Mdl';
  return dbutil.execQuery(sqldb.MySQLConPool, QRY, cntxtDtls);
  ```
- `execQuery` permits SELECT/INSERT/UPDATE/DELETE (DML); it REJECTS DDL.
- Column aliases in SELECTs **MUST** match the camelCase grid `field` names listed below.
- HARD RULE: if an entity has **no backing table**, the list model `return Promise.resolve([])` with a `// TODO` comment — NEVER name a non-existent table (it throws). For such entities, create/update/delete return `{status:200, message:'No-op (no backing table yet)'}`.
- IDs: `parseInt(req.params.id, 10) || 0`. Do not string-interpolate raw user strings in a way that breaks on quotes; keep SELECTs read-shaped like the example.

---

## 1. CANONICAL ENTITY TABLE

Frontend base path is under **`/web/<base>`**. "Folder" = `api/modules/web/<folder>`.
CRUD legend: **full** = list+get+create+update+delete; **read-only** = list+get only; **no-op** = list returns real rows or `[]`, writes return no-op message.

| /web base | folder | backing table | SELECT col → alias (must match grid fields) | CRUD |
|---|---|---|---|---|
| `partners` | partners | `usr_lst_t` (usr_typ_cd='owner') | usr_id→id, nm_tx→name, eml_tx→email, phn_nmbr_tx→phone, usr_typ_cd→role, (subq COUNT sttn_lst_t)→stations, CASE a_in→status, i_ts→createdAt | read-only (writes no-op) |
| `locations` | locations | `sttn_lst_t` | sttn_id→id, sttn_nm_tx→name, sttn_cd→code, cty_tx→city, stte_tx→state, ttl_chrgrs_nbr→totalChargers, prce_per_kwh_amt→pricePerKwh, rtng_nbr→rating, addr_tx→address, ltde_nbr→latitude, lngtde_nbr→longitude, CASE a_in→status | full |
| `users` | users | `usr_lst_t` | usr_id→id, nm_tx→name, eml_tx→email, phn_nmbr_tx→phone, usr_typ_cd→role, CASE a_in→status, i_ts→createdAt | full |
| `drivers` | drivers | `usr_lst_t` (usr_typ_cd='customer') + `wllt_lst_t` | usr_id→id, nm_tx→name, eml_tx→email, phn_nmbr_tx→phone, COALESCE(blnce_amt,0)→walletBalance, CASE a_in→status, i_ts→createdAt | full |
| `transactions` | transactions | `trxn_lst_t` (+ usr_lst_t for user name) | trxn_id→id, u.nm_tx→user, trxn_typ_cd→type, trxn_ctgry_cd→category, amt→amount, blnce_aftr_amt→balanceAfter, sttus_cd→status, i_ts→createdAt | read-only |
| `schedules` | schedules | `bkng_lst_t` (+ usr/sttn names) | bkng_id→id, bkng_cd→code, u.nm_tx→user, st.sttn_nm_tx→station, bkng_dte→date, bkng_tm→time, durn_mnts_nbr→durationMinutes, sttus_cd→status | read-only |
| `reservations` | reservations | `bkng_lst_t` (+ usr/sttn names) | bkng_id→id, bkng_cd→code, u.nm_tx→user, st.sttn_nm_tx→station, bkng_dte→date, bkng_tm→time, sttus_cd→status | read-only |
| `cards` | cards | `tkn_lst_t` (+ usr name) | id (tkn pk)→id, u.nm_tx→user, type, sttus_cd→status, expiry→expiresAt, i_ts→createdAt — **VERIFY tkn_lst_t cols; if absent → empty** | read-only / no-op |
| `reviews` | reviews | `rvw_lst_t` (+ usr/sttn names) | rvw pk→id, u.nm_tx→user, st.sttn_nm_tx→station, rtng→rating, review_text→review, i_ts→createdAt | read-only (delete no-op) |
| `coupons` | coupons | `offr_lst_t` | offr pk→id, code, title, discount_type→discountType, discount_value→discountValue, start→startDate, end→endDate, CASE a_in→status — **VERIFY offr_lst_t cols; map best-effort, else empty** | full |
| `reports` | reports | aggregates over `sssn_lst_t`/`trxn_lst_t`/`sttn_lst_t` | tabbed; returns `{rows,summary}` per type (sessions/revenue/energy/utilization/drivers/settlement) | read-only (special) |
| `disputes` | disputes | **NONE → empty** | user, subject, status, createdAt | no-op |
| `stations` | stations | `mchn_lst_t` (+ sttn name) | mchn_id→id, mchn_nm_tx→name, mchn_srl_no_tx→serial, ocpp_id_tx→ocppId, mchn_typ_cd→type, max_pwr_tx→power, ttl_cnntrs_nbr→connectors, st.sttn_nm_tx→station, sttus_cd→status | read-only |
| `businesses` | businesses | **NONE → empty** | name, email, phone, partners, locations, status, createdAt | no-op |
| `settlements` | settlements | `setlmnt_lst_t` (verify) else empty | partnerName, period, totalRevenue, commission, settlementAmount, status | read-only (settle no-op) |
| `subscriptions` | subscriptions | **NONE → empty** | name, price, billingCycle, subscribers, status | no-op |
| `member-groups` | memberGroups | **NONE → empty** | name, description, members, discountRate, status | no-op |
| `courtesy-sessions` | courtesySessions | **NONE → empty** | driverName, stationName, durationMinutes, reason, status, createdAt | no-op |
| `agents` | agents | **NONE → empty** | name, email, phone, region, status | no-op |
| `cdr` | cdr | `sssn_lst_t` (+ sttn/usr names) | sssn_id→cdrId, sssn_id→sessionId, st.sttn_nm_tx→stationName, u.nm_tx→driverName, enrgy_cnsmd_kwh→energyKwh, ttl_cst_amt→totalCost, strt_ts→startTime, sttus_cd→status | read-only |
| `emsp-tokens` | emspTokens | `tkn_lst_t` (verify) else empty | uid, type, contractId, issuer, status | full / no-op |
| `downtime` | downtime | **NONE → empty** | stationName, connectorId, reason, startTime, endTime, durationHours, status | no-op |
| `smart-scheduling` | smartScheduling | **NONE → empty** | name, stationName, startTime, endTime, maxPower, status | no-op |
| `connections` | connections | `mchn_lst_t` (+ sttn name) | st.sttn_nm_tx→stationName, ocpp_id_tx→ocppId, 'OCPP1.6J'→protocol, lst_hb_ts→lastHeartbeat, sttus_cd→status | read-only |
| `static-data` | staticData | `sttng_lst_t` (verify) else empty | category, code, label, value, status | read-only |
| `configurations` | configurations | **NONE → empty** | stationName, key, value, readonly, status | no-op (PUT save no-op) |
| `instructions` | instructions | **NONE → empty** | title, category, audience, updatedAt, status | no-op |
| `roles` | roles | **NONE → empty** | name, description, users, status | no-op |
| `products` | products | **NONE → empty** | name, category, url, status | no-op |
| `settings` | settings | `sttng_lst_t` (verify) else empty/echo | scope-keyed key/value blob `{status,row|settings}` | read-only get + PUT no-op |
| `live-sessions` | (reuse stations or new `liveSessions`) | `sssn_lst_t` (sttus_cd='active', + sttn/usr) | sssn_id→id, st.sttn_nm_tx→stationName, u.nm_tx→driverName, enrgy_cnsmd_kwh→energy, prgrss_pct→progress, strt_ts→startTime, sttus_cd→status | read-only (stop no-op) |
| `stations/bulk-remote` | (in stationsRtr) | n/a (command) | POST `{action, stationIds}` → echo `{status,message}` | no-op action |

> NONE → empty entities (write `return Promise.resolve([])` in list): **disputes, businesses, subscriptions, member-groups, courtesy-sessions, agents, downtime, smart-scheduling, configurations, instructions, roles, products**.
> VERIFY-then-empty (run `DESCRIBE` first; map real cols if present, otherwise empty): **cards/emsp-tokens (`tkn_lst_t`), coupons (`offr_lst_t`), reviews (`rvw_lst_t`), settlements (`setlmnt_lst_t`), static-data/settings (`sttng_lst_t`)**.

---

## 2. RESPONSE SHAPES (exact)

All under `/api/web/...`. Controller wraps every call in `.then/.catch`; on error
`res.status(500).json({ status:500, error:'...' })`.

```js
// LIST   GET /web/<base>
res.status(200).json({ status: 200, rows: rows || [] });

// GET    GET /web/<base>/:id
res.status(200).json({ status: 200, row: (rows && rows[0]) || null });

// CREATE POST /web/<base>      | UPDATE PUT /web/<base>/:id | DELETE DELETE /web/<base>/:id
res.status(200).json({ status: 200, message: '<Entity> created|updated|deleted' });   // echo row where easy
// no-op entities:
res.status(200).json({ status: 200, message: 'No-op (no backing table yet)' });

// SETTINGS get  GET /web/settings/:scope
res.status(200).json({ status: 200, row: settingsObj || {} });   // frontend SettingsForm reads res.data (object of key→value); return the blob
// SETTINGS save PUT /web/settings/:scope    (and PUT /web/configurations)
res.status(200).json({ status: 200, message: 'Settings saved' });   // no-op if no table

// BULK REMOTE  POST /web/stations/bulk-remote   body { action, stationIds[] }
res.status(200).json({ status: 200, message: `"${action}" sent to N station(s)` });
```

Frontend extraction (`ResourceListPage.guessRows`): prefers `data.rows`, then `data.data`,
then first array-valued prop. So **always return `rows`**. `SettingsForm` consumes the
loader response body directly as the values object.

---

## 3. FRONTEND ALIGNMENT (path mismatches to fix)

The frontend `services/api.ts` currently calls **list/get under `/web/...`** but
**create/update/delete and a few specials WITHOUT the `/web` prefix**. Backend routers
live only under `/web`. **Fix the frontend so EVERY call is under `/web`** (preferred —
no backend change), OR mount duplicate top-level routers (not recommended).

Required final frontend paths (edit `D:/personal/djt-web/frontend/src/services/api.ts`):

| API method | current (wrong) | must become |
|---|---|---|
| `usersApi.create/update/delete` | `/users…` | `/web/users…` |
| `partnersApi.create/update/delete` + wallet/stats | `/partners…` | `/web/partners…` |
| `locationsApi.create/update/delete` + nearby | `/locations…` | `/web/locations…` |
| `stationsApi.create/update/delete/reset/remote-*` | `/stations…` | `/web/stations…` |
| `driversApi.*` (create/update/delete/wallet/...) | `/drivers…` | `/web/drivers…` |
| `reservationsApi.create/cancel/slots` | `/reservations…` | `/web/reservations…` |
| `cardsApi.create/update/block/unblock/delete` | `/cards…` | `/web/cards…` |
| `disputesApi.create/update/resolve` | `/disputes…` | `/web/disputes…` |
| `couponsApi.create/update/delete/validate` | `/coupons…` | `/web/coupons…` |
| `reviewsApi.reply/delete/byStation` | `/reviews…` | `/web/reviews…` |
| generic `crud(base)` create/update/delete | `/${base}…` | `/web/${base}…` (covers businesses, settlements, subscriptions, member-groups, courtesy-sessions, agents, emsp-tokens, smart-scheduling, roles, products) |
| `settlementsApi.markSettled` | `/settlements/:id/settle` | `/web/settlements/:id/settle` |
| `configurationsApi.save` | `PUT /configurations` | **`PUT /web/configurations`** |
| `settingsApi.save` | `PUT /settings/:scope` | **`PUT /web/settings/:scope`** |
| `sessionsApi.getActive` (LiveSessions) | `GET /sessions/active` | **`GET /web/live-sessions`** |
| `sessionsApi.stop` (LiveSessions) | `POST /sessions/:id/stop` | **`POST /web/live-sessions/:id/stop`** (or `/web/stations/:id/remote-stop`) |
| `bulkRemoteApi.execute` | `POST /stations/bulk-remote` | **`POST /web/stations/bulk-remote`** |

**Canonical endpoint set the backend MUST expose** (all behind `/api/web`):
- Resource list/get/create/update/delete: `GET /web/<base>`, `GET /web/<base>/:id`, `POST /web/<base>`, `PUT /web/<base>/:id`, `DELETE /web/<base>/:id`.
- Settings: `GET /web/settings/:scope` and `PUT /web/settings/:scope`.
- Configurations save: `PUT /web/configurations` (in addition to its `GET /web/configurations` list).
- Live sessions: `GET /web/live-sessions` (+ optional `POST /web/live-sessions/:id/stop`).
- Bulk remote: `POST /web/stations/bulk-remote`.

---

## 4. FILE CHECKLIST

### A. Existing 13 entities — upgrade read-only → full CRUD where table is writable
For each of: **locations, users, drivers, coupons** (the ones the UI offers create/update/delete on) add `createMdl/updateMdl/deleteMdl` to the model, `create/update/delete` to the controller, and the 3 write routes to the router. **partners, transactions, schedules, reservations, cards, reviews, reports, disputes, stations** stay read-only (writes, if the UI calls them, return no-op — but per HARD RULE only no-op where appropriate).
- Edit `api/modules/web/<e>/models/<e>Mdl.js`  (add write fns; DML via execQuery)
- Edit `api/modules/web/<e>/controllers/<e>Ctrl.js`  (add create/get-shape/update/delete)
- Edit `api/routes/web/<e>Rtr.js`  (add `post '/'`, `put '/:id'`, `delete '/:id'`)

### B. New entity modules to CREATE (model + controller + router, then register in webRtr.js)
For each `<folder>` create:
- `api/modules/web/<folder>/models/<folder>Mdl.js`
- `api/modules/web/<folder>/controllers/<folder>Ctrl.js`
- `api/routes/web/<base>Rtr.js`

New entities (folder | base):
- businesses | `businesses`  (empty/no-op)
- settlements | `settlements`  (real `setlmnt_lst_t` if present; + `POST /:id/settle` no-op)
- subscriptions | `subscriptions`  (empty/no-op)
- memberGroups | `member-groups`  (empty/no-op)
- courtesySessions | `courtesy-sessions`  (empty/no-op)
- agents | `agents`  (empty/no-op)
- cdr | `cdr`  (real `sssn_lst_t`; list only)
- emspTokens | `emsp-tokens`  (real `tkn_lst_t` if present, else empty; full/no-op)
- downtime | `downtime`  (empty/no-op)
- smartScheduling | `smart-scheduling`  (empty/no-op)
- connections | `connections`  (real `mchn_lst_t`; list only, auto-refresh)
- staticData | `static-data`  (real `sttng_lst_t` if present, else empty)
- configurations | `configurations`  (empty list + `PUT /web/configurations` no-op)
- instructions | `instructions`  (empty/no-op)
- roles | `roles`  (empty/no-op)
- products | `products`  (empty/no-op)
- settings | `settings`  (`GET /web/settings/:scope` real `sttng_lst_t`-keyed or `{}`, `PUT` no-op)
- liveSessions | `live-sessions`  (real `sssn_lst_t` active; `GET /` + `POST /:id/stop` no-op)

### C. `stations/bulk-remote`
- Add `POST /bulk-remote` to `api/routes/web/stationsRtr.js` → controller method `bulkRemote` that echoes `{status:200, message:'"<action>" sent to N station(s)'}` (no-op command for now).

### D. Register every new router in `api/routes/web/webRtr.js`
Add one `router.use('/<base>', require('./<base>Rtr'));` line per new entity (use the exact `<base>` from §1, e.g. `member-groups`, `courtesy-sessions`, `emsp-tokens`, `smart-scheduling`, `static-data`, `live-sessions`). Keep `bulk-remote` inside `stationsRtr`.

### E. Frontend
- Edit `D:/personal/djt-web/frontend/src/services/api.ts` per §3 (prefix all write/special calls with `/web`, repoint live-sessions to `/web/live-sessions`, settings/configurations saves to `/web/...`).

### F. Verify-first columns
Before writing SELECTs for **tkn_lst_t, offr_lst_t, rvw_lst_t, setlmnt_lst_t, sttng_lst_t**, run `DESCRIBE <table>;` (read-only). Map real columns to the required aliases; if the table is missing or lacks the needed columns, fall back to `return Promise.resolve([])` with a `// TODO` and make writes no-op.
