/**
 * OCPP 1.6J message handlers (CP -> CSMS).
 * Each handler: async (payload, ctx) -> responsePayload
 *   ctx = { conn, registry, ocppMdl, nowIso, OcppError }
 *
 * Implemented core flow:
 *   BootNotification, Heartbeat, StatusNotification, Authorize,
 *   StartTransaction / StopTransaction (-> settle), MeterValues.
 */

const walletMdl = require('../modules/wallet/models/walletMdl');
const ledgerService = require('../modules/ledger/services/ledgerService');

// transactionId -> starting meter register (kWh) for delta energy calculation
const txnBaselines = new Map();

// transactionIds we've already asked the charger to stop because the driver's
// prepaid units were fully consumed — prevents sending RemoteStop on every
// subsequent MeterValues while the charger winds down.
const capStopRequested = new Set();

const HEARTBEAT_INTERVAL = 300; // seconds

// OCPP 1.6 requires the CSMS to assign an INTEGER transactionId in the
// StartTransaction response. Monotonic int32 seeded from the clock; the charger
// echoes it in MeterValues / StopTransaction so we match the session by it
// (stored as text in ocpp_txn_id_tx).
let TXN_SEQ = Math.floor(Date.now() / 1000) % 2000000000;
function nextTransactionId() {
    TXN_SEQ = (TXN_SEQ + 1) % 2147483647;
    return TXN_SEQ;
}

// Map OCPP 1.6 StatusNotification.status -> our per-CONNECTOR status enum.
// NOTE: 'Charging' is the ONLY status that means energy is actually flowing —
// the app gates its "Charging in Progress" screen on it. Suspended states are
// kept distinct so the app can show "paused by vehicle / charger".
const CONNECTOR_STATUS_MAP = {
    Available: 'available',
    Preparing: 'occupied',      // cable plugged, not charging yet
    Charging: 'charging',       // energy actually flowing
    SuspendedEV: 'suspended_ev',      // charger ready, vehicle paused it
    SuspendedEVSE: 'suspended_evse',  // vehicle ready, charger paused it
    Finishing: 'occupied',
    Reserved: 'reserved',
    Unavailable: 'unavailable',
    Faulted: 'faulted',
};

// Ensure conn is bound to its machine (lazy lookup if Boot hasn't run yet)
async function ensureMachine(ctx) {
    const { conn, ocppMdl } = ctx;
    if (conn.machineId) return conn._machine || null;
    const rows = await ocppMdl.getMachineByOcppIdMdl(conn.ocppId);
    const m = rows && rows[0];
    if (m) {
        conn.machineId = m.mchn_id;
        conn.stationId = m.sttn_id;
        conn.pricePerKwh = parseFloat(m.prce_per_kwh_amt) || 0;
        conn._machine = m;
    }
    return m || null;
}

// Flatten every sampledValue across ALL meterValue[] entries. Real chargers often
// split each measurand into its OWN meterValue[] element (energy, SoC, voltage,
// current, temperature…), so we must scan them all — not just the last entry.
function flattenSamples(meterValues) {
    if (!Array.isArray(meterValues)) return [];
    const out = [];
    for (const mv of meterValues) {
        const samples = (mv && mv.sampledValue) || [];
        for (const s of samples) out.push(s);
    }
    return out;
}

// Pull the Energy.Active.Import.Register reading (in kWh) from a meterValue array.
// Searches all entries for the energy register (measurand match preferred; a
// sample with no measurand defaults to that register per spec).
function extractRegisterKwh(meterValues) {
    const all = flattenSamples(meterValues);
    if (!all.length) return null;
    let s = all.filter((x) => x.measurand === 'Energy.Active.Import.Register').pop()
         || all.filter((x) => !x.measurand).pop();
    if (!s) return null;
    let val = Number(s.value);
    if (isNaN(val)) return null;
    const unit = (s.unitOfMeasure && s.unitOfMeasure.unit) || s.unit || 'Wh';
    if (unit === 'Wh') val = val / 1000; // -> kWh (kWh passes through)
    return val;
}

// Battery State of Charge (%) if the vehicle/charger reports it, else null.
function extractSoc(meterValues) {
    const s = flattenSamples(meterValues).filter((x) => x.measurand === 'SoC').pop();
    if (!s) return null;
    const v = Number(s.value);
    return isNaN(v) ? null : v;
}

// energy (kWh) consumed in this transaction so far, using a start baseline
function consumedKwh(transactionId, currentRegisterKwh) {
    if (currentRegisterKwh == null) return 0;
    if (!txnBaselines.has(transactionId)) {
        txnBaselines.set(transactionId, currentRegisterKwh);
        return 0;
    }
    return Math.max(0, currentRegisterKwh - txnBaselines.get(transactionId));
}

const handlers = {
    /* ---------------------------------------------------------------- */
    async BootNotification(payload, ctx) {
        const machine = await ensureMachine(ctx);
        if (!machine) {
            console.warn(`[OCPP] BootNotification from unknown charge point ${ctx.conn.ocppId}`);
            return { currentTime: ctx.nowIso(), interval: HEARTBEAT_INTERVAL, status: 'Rejected' };
        }
        await ctx.ocppMdl.touchMachineMdl(machine.mchn_id, 'available');
        console.log(`[OCPP] Boot accepted: ${ctx.conn.ocppId} (machine ${machine.mchn_id})`);
        return { currentTime: ctx.nowIso(), interval: HEARTBEAT_INTERVAL, status: 'Accepted' };
    },

    /* ---------------------------------------------------------------- */
    async Heartbeat(_payload, ctx) {
        if (ctx.conn.machineId) {
            await ctx.ocppMdl.touchMachineMdl(ctx.conn.machineId);
        }
        return { currentTime: ctx.nowIso() };
    },

    /* ---------------------------------------------------------------- */
    async StatusNotification(payload, ctx) {
        const machine = await ensureMachine(ctx);
        // OCPP 1.6 StatusNotification is PER CONNECTOR: { connectorId, status, errorCode }.
        // e.g. "Preparing" when the cable is plugged into the vehicle -> 'occupied',
        // which the customer app reads as "plugged in".
        const rawStatus = payload.status;
        const connectorId = Number(payload.connectorId) || 1;
        const connStatus = CONNECTOR_STATUS_MAP[rawStatus] || 'available';
        const isAvailable = rawStatus === 'Available';
        console.log(`[OCPP][StatusNotification] ${ctx.conn.ocppId} conn#${connectorId} raw='${rawStatus}' -> mapped='${connStatus}' isAvailable=${isAvailable} (payload keys: ${Object.keys(payload).join(',')})`);

        if (!machine) {
            console.warn(`[OCPP][StatusNotification] no machine bound for ${ctx.conn.ocppId} — status ignored`);
            return {};
        }
        // Resolve the machine's Nth connector (1-based) and update ONLY that one.
        const conns = await ctx.ocppMdl.getMachineConnectorsMdl(machine.mchn_id);
        const target = conns[connectorId - 1] || conns[0];
        if (target) {
            await ctx.ocppMdl.updateConnectorStatusMdl(target.cnntr_id, connStatus, isAvailable);
            // Recompute the machine badge from all its connectors.
            await ctx.ocppMdl.recalcMachineStatusMdl(machine.mchn_id);
            console.log(`[OCPP][StatusNotification] updated connector cnntr_id=${target.cnntr_id} -> '${connStatus}' for machine ${machine.mchn_id}`);
        } else {
            console.warn(`[OCPP][StatusNotification] machine ${machine.mchn_id} has no connector at index ${connectorId - 1}`);
        }
        return {};
    },

    /* ---------------------------------------------------------------- */
    async Authorize(payload, ctx) {
        // OCPP 1.6: { idTag } request, { idTagInfo: { status } } response.
        const token = payload && payload.idTag;
        if (!token) return { idTagInfo: { status: 'Invalid' } };

        const rows = await ctx.ocppMdl.getUserByIdTokenMdl(token);
        const user = rows && rows[0];
        if (!user) {
            console.warn(`[OCPP][1.6][Authorize] ${ctx.conn.ocppId} idTag='${token}' -> Invalid (no user)`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        ctx.conn.authorizedUser = user;

        // App-initiated remote start already authorized + prepaid this driver (funds
        // held in escrow). Accept without re-checking the now-reduced wallet balance.
        const pending = ctx.conn.pendingRemoteAuth;
        if (pending && pending.idTag === String(token) && pending.until > Date.now()) {
            console.log(`[OCPP][1.6][Authorize] ${ctx.conn.ocppId} idTag='${token}' user#${user.usr_id} -> Accepted (prepaid remote start)`);
            return { idTagInfo: { status: 'Accepted' } };
        }

        // Walk-up / post-pay: require a positive balance. (1.6 has no 'NoCredit'
        // status — 'Blocked' is the closest standard value.)
        const wRows = await walletMdl.getUserWalletMdl({ userId: user.usr_id });
        const balance = wRows && wRows[0] ? parseFloat(wRows[0].blnce_amt) || 0 : 0;
        const status = balance <= 0 ? 'Blocked' : 'Accepted';
        console.log(`[OCPP][1.6][Authorize] ${ctx.conn.ocppId} idTag='${token}' user#${user.usr_id} balance=₹${balance} -> ${status}`);
        return { idTagInfo: { status } };
    },

    /* ================================================================ */
    /* OCPP 1.6 transaction messages */
    /* ================================================================ */

    // OCPP 1.6 StartTransaction: the CSMS assigns the integer transactionId and
    // returns it. Reconciles with an app session (RemoteStart) or creates a
    // charger-initiated one, keyed on 1.6's connectorId + meterStart.
    async StartTransaction(payload, ctx) {
        const { conn, ocppMdl } = ctx;
        const machine = await ensureMachine(ctx);
        if (!machine) return { transactionId: 0, idTagInfo: { status: 'Invalid' } };

        const connOrdinal = Number(payload.connectorId) || 1;
        const conns = await ocppMdl.getMachineConnectorsMdl(machine.mchn_id);
        const targetConn = conns[connOrdinal - 1] || conns[0];
        const connectorId = targetConn ? targetConn.cnntr_id : null;
        if (!connectorId) return { transactionId: 0, idTagInfo: { status: 'Invalid' } };

        const txnId = nextTransactionId();
        const txnKey = String(txnId);
        // 1.6 meterStart is the register value in Wh at the start of the transaction.
        const meterStartKwh = payload.meterStart != null ? Number(payload.meterStart) / 1000 : 0;
        if (!isNaN(meterStartKwh)) txnBaselines.set(txnKey, meterStartKwh);

        // RECONCILE with an app-created session (RemoteStart) on this connector.
        const unlinked = await ocppMdl.getUnlinkedSessionForConnectorMdl(connectorId);
        const existing = unlinked && unlinked[0];
        if (existing) {
            await ocppMdl.attachOcppTxnMdl(existing.sssn_id, txnKey);
            // Do NOT force 'charging' here — StartTransaction only means the
            // transaction was CREATED, not that energy is flowing. The connector's
            // live status is owned by StatusNotification (Charging / SuspendedEV /
            // …), so the app only shows "Charging in Progress" once the machine
            // actually confirms it. Just refresh the machine badge.
            await ocppMdl.recalcMachineStatusMdl(machine.mchn_id);
            console.log(`[OCPP][1.6] StartTransaction txn=${txnId} linked to app session#${existing.sssn_id} (connector ${connectorId}) — awaiting StatusNotification(Charging)`);
            return { transactionId: txnId, idTagInfo: { status: 'Accepted' } };
        }

        // No app session -> charger-initiated (post-pay). Resolve the user by idTag.
        let user = conn.authorizedUser;
        if (payload.idTag) {
            const rows = await ocppMdl.getUserByIdTokenMdl(payload.idTag);
            user = (rows && rows[0]) || user;
        }
        if (!user) return { transactionId: txnId, idTagInfo: { status: 'Invalid' } };

        const sessionCode = 'OCPP-' + Date.now().toString(36).toUpperCase();
        const res = await ocppMdl.createOcppSessionMdl({
            sessionCode, userId: user.usr_id, stationId: machine.sttn_id,
            connectorId, pricePerKwh: conn.pricePerKwh, ocppTxnId: txnKey,
        });
        // Connector live status is owned by StatusNotification (see note above).
        await ocppMdl.recalcMachineStatusMdl(machine.mchn_id);
        console.log(`[OCPP][1.6] StartTransaction txn=${txnId} session#${res.insertId} user#${user.usr_id} @ ${conn.ocppId} — awaiting StatusNotification(Charging)`);
        return { transactionId: txnId, idTagInfo: { status: 'Accepted' } };
    },

    // OCPP 1.6 StopTransaction: final meter reading (meterStop, Wh) + reason.
    // Finalizes and settles the session (escrow refund or post-pay wallet debit).
    async StopTransaction(payload, ctx) {
        const { conn, ocppMdl } = ctx;
        const machine = await ensureMachine(ctx);
        const txnKey = String(payload.transactionId);
        const sRows = await ocppMdl.getSessionByOcppTxnMdl(txnKey);
        const session = sRows && sRows[0];
        if (!session) return { idTagInfo: { status: 'Accepted' } };

        // Prefer meterStop (Wh) delta over baseline; fall back to whatever MeterValues stored.
        const meterStopKwh = payload.meterStop != null ? Number(payload.meterStop) / 1000 : null;
        let energy;
        if (meterStopKwh != null && !isNaN(meterStopKwh) && txnBaselines.has(txnKey)) {
            energy = Math.max(0, meterStopKwh - txnBaselines.get(txnKey));
        } else {
            energy = parseFloat(session.enrgy_cnsmd_kwh) || 0;
        }
        const price = parseFloat(session.prce_per_kwh_amt) || conn.pricePerKwh || 0;
        const cost = +(energy * price).toFixed(2);

        // connector back to occupied (cable may still be in); a StatusNotification refines it
        if (session.cnntr_id) await ocppMdl.updateConnectorStatusMdl(session.cnntr_id, 'occupied', false);
        if (machine) await ocppMdl.recalcMachineStatusMdl(machine.mchn_id);
        txnBaselines.delete(txnKey);
        capStopRequested.delete(txnKey);

        await finalizeAndSettle(ctx, session, energy, cost);

        console.log(`[OCPP][1.6] StopTransaction txn=${payload.transactionId} session#${session.sssn_id} energy=${energy}kWh cost=₹${cost}`);
        return { idTagInfo: { status: 'Accepted' } };
    },

    /* ---------------------------------------------------------------- */
    async MeterValues(payload, ctx) {
        // Live meter values during a transaction.
        const machine = await ensureMachine(ctx);
        if (!machine) return {};
        const reg = extractRegisterKwh(payload.meterValue);
        if (reg == null) {
            console.log(`[OCPP][1.6][MeterValues] ${ctx.conn.ocppId} ignored (no energy register in payload)`);
            return {};
        }

        // Resolve the session: prefer the txn id the charger echoes; but some
        // chargers send clock-aligned MeterValues with transactionId=0 — fall back
        // to the active session on THIS connector so those samples still count.
        const rawTxn = payload.transactionId;
        let session = null;
        if (rawTxn != null && String(rawTxn) !== '0') {
            const sRows = await ctx.ocppMdl.getSessionByOcppTxnMdl(String(rawTxn));
            session = sRows && sRows[0];
        }
        if (!session) {
            const connOrdinal = Number(payload.connectorId) || 1;
            const conns = await ctx.ocppMdl.getMachineConnectorsMdl(machine.mchn_id);
            const targetConn = conns[connOrdinal - 1] || conns[0];
            if (targetConn) {
                const sRows = await ctx.ocppMdl.getActiveSessionForConnectorMdl(targetConn.cnntr_id);
                session = sRows && sRows[0];
            }
        }
        if (!session) {
            console.log(`[OCPP][1.6][MeterValues] ${ctx.conn.ocppId} txn=${rawTxn} — no active session on connector`);
            return {};
        }

        // Baseline/cap are keyed by the session's real OCPP txn id (set at
        // StartTransaction), NOT the possibly-zero payload transactionId.
        const txnKey = session.ocpp_txn_id_tx ? String(session.ocpp_txn_id_tx) : 'sess-' + session.sssn_id;
        const energy = consumedKwh(txnKey, reg);
        const price = parseFloat(session.prce_per_kwh_amt) || ctx.conn.pricePerKwh || 0;
        const cost = +(energy * price).toFixed(2);
        // Prepaid units = the held amount (ttl_cst_amt) / price. Progress is measured
        // against what the driver actually bought, not a nominal fill.
        const prepaid = parseFloat(session.ttl_cst_amt) || 0;
        const purchasedUnits = price > 0 ? prepaid / price : 0;
        const progress = purchasedUnits > 0
            ? Math.min(99, Math.round((energy / purchasedUnits) * 100))
            : Math.min(99, Math.round((energy / 30) * 100));
        const soc = extractSoc(payload.meterValue);
        await ctx.ocppMdl.updateOcppSessionProgressMdl({ sessionId: session.sssn_id, energyKwh: energy, cost, progress });
        console.log(`[OCPP][1.6][MeterValues] ${ctx.conn.ocppId} session#${session.sssn_id} register=${reg}kWh energy=${energy.toFixed(3)}/${purchasedUnits}kWh cost=₹${cost} progress=${progress}%${soc != null ? ` soc=${soc}%` : ''}`);

        // PREPAID CAP: once the driver's purchased units are consumed, stop the
        // transaction server-side (authoritative). Fire-and-forget RemoteStop; the
        // charger's StopTransaction then finalizes + settles from the real meter.
        if (purchasedUnits > 0 && energy >= purchasedUnits && session.ocpp_txn_id_tx && !capStopRequested.has(txnKey) && ctx.sendCall) {
            capStopRequested.add(txnKey);
            console.log(`[OCPP][1.6] prepaid cap reached (${energy.toFixed(3)} >= ${purchasedUnits} kWh) — auto-stopping txn=${session.ocpp_txn_id_tx}`);
            ctx.sendCall(ctx.conn, 'RemoteStopTransaction', { transactionId: Number(session.ocpp_txn_id_tx) || session.ocpp_txn_id_tx })
                .catch((e) => console.error('[OCPP] cap RemoteStop failed:', e.message));
        }
        return {};
    },

    /* ---------------------------------------------------------------- */
    // Optional CP->CSMS messages some 1.6 chargers send. Acknowledge them so the
    // charger doesn't get a CALLERROR (which can make firmware retry/disconnect).
    async DataTransfer(_payload, _ctx) {
        return { status: 'Accepted' };
    },
    async FirmwareStatusNotification(_payload, _ctx) {
        return {};
    },
    async DiagnosticsStatusNotification(_payload, _ctx) {
        return {};
    },
};

// Finalize + settle a session ended by the charger (from 1.6 StopTransaction).
// Idempotent: only acts while the session is still 'active' (the app's Stop may
// have already settled it).
async function finalizeAndSettle(ctx, session, energy, cost) {
    const { ocppMdl } = ctx;
    if (session.sttus_cd !== 'active') return;

    // Record the ACTUAL metered energy/cost from the charger (even if it overshot
    // the purchased units — that's the real energy delivered). The ledger below
    // still only moves what's actually available (escrow caps consumed to the
    // hold), but the session row reflects true consumption.
    await ocppMdl.finalizeOcppSessionMdl({ sessionId: session.sssn_id, energyKwh: energy, cost });

    // Prepaid (app-initiated, escrow held) vs charger-initiated (post-pay).
    let hold = null;
    try { hold = await ledgerService.getSessionHold(session.sssn_id); } catch (e) { /* legacy */ }
    if (hold) {
        // Charger ended a prepaid session on its own -> settle the escrow
        // (idempotent: if the app's Stop already settled, this is a no-op).
        try {
            const ownerRows = await ocppMdl.getStationOwnerMdl(session.sttn_id);
            const ownerUserId = ownerRows && ownerRows[0] ? ownerRows[0].ownr_usr_id : null;
            await ledgerService.chargingSettle({
                userId: session.usr_id, sessionId: session.sssn_id, stationId: session.sttn_id,
                ownerUserId, holdAmount: parseFloat(hold.ttl_amt) || 0, consumedAmount: cost,
                audit: { actnCd: 'charging_payment', userId: session.usr_id },
            });
            await ocppMdl.setSessionPaymentMdl({ sessionId: session.sssn_id, status: 'paid' });
        } catch (e) {
            console.error('[OCPP] escrow settle failed:', e.message);
        }
    } else {
        // Charger-initiated post-pay: debit the wallet for the actual cost
        await settleWallet(ctx, session, cost).catch((e) =>
            console.error('[OCPP] wallet settle failed:', e.message));
    }
}

// Debit the wallet for a completed session (post-pay model)
async function settleWallet(ctx, session, cost) {
    const userId = session.usr_id;
    if (!cost || cost <= 0) {
        await ctx.ocppMdl.setSessionPaymentMdl({ sessionId: session.sssn_id, status: 'paid' });
        return;
    }
    const wRows = await walletMdl.getUserWalletMdl({ userId });
    const wallet = wRows && wRows[0];
    if (!wallet) {
        await ctx.ocppMdl.setSessionPaymentMdl({ sessionId: session.sssn_id, status: 'pending' });
        return;
    }
    const balance = parseFloat(wallet.blnce_amt) || 0;
    if (balance < cost) {
        // Not enough credit — leave unpaid for later collection
        await ctx.ocppMdl.setSessionPaymentMdl({ sessionId: session.sssn_id, status: 'pending' });
        return;
    }
    await walletMdl.deductMoneyMdl({ walletId: wallet.wllt_id, amount: cost, userId });
    const txn = await walletMdl.createTransactionMdl({
        walletId: wallet.wllt_id,
        userId,
        type: 'debit',
        category: 'charging',
        amount: cost,
        balanceBefore: balance,
        balanceAfter: +(balance - cost).toFixed(2),
        description: `Charging session ${session.sssn_cd}`,
        status: 'completed',
        referenceId: session.sssn_id,
        referenceType: 'session',
    });
    await ctx.ocppMdl.setSessionPaymentMdl({
        sessionId: session.sssn_id,
        status: 'paid',
        transactionId: txn && txn.insertId,
    });
}

module.exports = handlers;
