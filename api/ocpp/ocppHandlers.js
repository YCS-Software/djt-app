/**
 * OCPP 2.0.1 message handlers (CP -> CSMS).
 * Each handler: async (payload, ctx) -> responsePayload
 *   ctx = { conn, registry, ocppMdl, nowIso, OcppError }
 *
 * Implemented core flow:
 *   BootNotification, Heartbeat, StatusNotification, Authorize,
 *   TransactionEvent (Started/Updated/Ended -> wallet debit), MeterValues.
 */

const walletMdl = require('../modules/wallet/models/walletMdl');

// transactionId -> starting meter register (kWh) for delta energy calculation
const txnBaselines = new Map();

const HEARTBEAT_INTERVAL = 300; // seconds

// Map OCPP connector status -> our machine status enum
const STATUS_MAP = {
    Available: 'available',
    Occupied: 'in_use',
    Reserved: 'in_use',
    Unavailable: 'maintenance',
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

// Pull the Energy.Active.Import.Register reading (in kWh) from a meterValue array
function extractRegisterKwh(meterValues) {
    if (!Array.isArray(meterValues) || meterValues.length === 0) return null;
    const last = meterValues[meterValues.length - 1];
    const samples = (last && last.sampledValue) || [];
    // Prefer the energy register; fall back to the first sample
    let s = samples.find((x) => !x.measurand || x.measurand === 'Energy.Active.Import.Register');
    if (!s) s = samples[0];
    if (!s) return null;
    let val = Number(s.value);
    if (isNaN(val)) return null;
    const unit = (s.unitOfMeasure && s.unitOfMeasure.unit) || s.unit || 'Wh';
    if (unit === 'Wh') val = val / 1000; // -> kWh
    return val;
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
        if (machine) {
            const status = STATUS_MAP[payload.connectorStatus] || 'available';
            await ctx.ocppMdl.setMachineStatusMdl(machine.mchn_id, status);
            await ctx.ocppMdl.setConnectorAvailabilityMdl(machine.mchn_id, payload.connectorStatus === 'Available');
        }
        return {};
    },

    /* ---------------------------------------------------------------- */
    async Authorize(payload, ctx) {
        const token = payload && payload.idToken ? payload.idToken.idToken : null;
        if (!token) return { idTokenInfo: { status: 'Invalid' } };

        const rows = await ctx.ocppMdl.getUserByIdTokenMdl(token);
        const user = rows && rows[0];
        if (!user) return { idTokenInfo: { status: 'Invalid' } };

        const wRows = await walletMdl.getUserWalletMdl({ userId: user.usr_id });
        const balance = wRows && wRows[0] ? parseFloat(wRows[0].blnce_amt) || 0 : 0;
        ctx.conn.authorizedUser = user;
        if (balance <= 0) return { idTokenInfo: { status: 'NoCredit' } };
        return { idTokenInfo: { status: 'Accepted' } };
    },

    /* ---------------------------------------------------------------- */
    async TransactionEvent(payload, ctx) {
        const { conn, ocppMdl } = ctx;
        const txnId = payload.transactionInfo && payload.transactionInfo.transactionId;
        const machine = await ensureMachine(ctx);
        if (!machine || !txnId) {
            return {}; // nothing we can attach to
        }

        // ---- STARTED ----
        if (payload.eventType === 'Started') {
            // Resolve the user (this event's idToken, else previously authorized)
            let user = conn.authorizedUser;
            const evToken = payload.idToken && payload.idToken.idToken;
            if (evToken) {
                const rows = await ocppMdl.getUserByIdTokenMdl(evToken);
                user = (rows && rows[0]) || user;
            }
            if (!user) {
                return { idTokenInfo: { status: 'Invalid' } };
            }

            // baseline meter register for delta energy
            const startKwh = extractRegisterKwh(payload.meterValue);
            if (startKwh != null) txnBaselines.set(txnId, startKwh);

            const connRows = await ocppMdl.getFirstConnectorForMachineMdl(machine.mchn_id);
            const connectorId = connRows && connRows[0] ? connRows[0].cnntr_id : null;
            if (!connectorId) {
                throw new ctx.OcppError('GenericError', 'No connector configured for this machine');
            }

            const sessionCode = 'OCPP-' + Date.now().toString(36).toUpperCase();
            const res = await ocppMdl.createOcppSessionMdl({
                sessionCode,
                userId: user.usr_id,
                stationId: machine.sttn_id,
                connectorId,
                pricePerKwh: conn.pricePerKwh,
                ocppTxnId: txnId,
            });
            await ocppMdl.setMachineStatusMdl(machine.mchn_id, 'in_use');
            console.log(`[OCPP] Txn started ${txnId} session#${res.insertId} user#${user.usr_id} @ ${conn.ocppId}`);
            return { idTokenInfo: { status: 'Accepted' } };
        }

        // ---- UPDATED ----
        if (payload.eventType === 'Updated') {
            const sRows = await ocppMdl.getSessionByOcppTxnMdl(txnId);
            const session = sRows && sRows[0];
            if (!session) return {};
            const reg = extractRegisterKwh(payload.meterValue);
            const energy = consumedKwh(txnId, reg);
            const price = parseFloat(session.prce_per_kwh_amt) || conn.pricePerKwh || 0;
            const cost = +(energy * price).toFixed(2);
            // crude progress proxy (kWh toward a nominal 30kWh fill), capped at 99 until ended
            const progress = Math.min(99, Math.round((energy / 30) * 100));
            await ocppMdl.updateOcppSessionProgressMdl({ sessionId: session.sssn_id, energyKwh: energy, cost, progress });
            return {};
        }

        // ---- ENDED ----
        if (payload.eventType === 'Ended') {
            const sRows = await ocppMdl.getSessionByOcppTxnMdl(txnId);
            const session = sRows && sRows[0];
            if (!session) return {};

            const reg = extractRegisterKwh(payload.meterValue);
            const energy = consumedKwh(txnId, reg);
            const price = parseFloat(session.prce_per_kwh_amt) || conn.pricePerKwh || 0;
            const cost = +(energy * price).toFixed(2);

            await ocppMdl.finalizeOcppSessionMdl({ sessionId: session.sssn_id, energyKwh: energy, cost });
            await ocppMdl.setMachineStatusMdl(machine.mchn_id, 'available');
            txnBaselines.delete(txnId);

            // Post-pay: debit the user's wallet for the actual cost
            await settleWallet(ctx, session, cost).catch((e) =>
                console.error('[OCPP] wallet settle failed:', e.message));

            console.log(`[OCPP] Txn ended ${txnId} session#${session.sssn_id} energy=${energy}kWh cost=₹${cost}`);
            return { totalCost: cost, idTokenInfo: { status: 'Accepted' } };
        }

        return {};
    },

    /* ---------------------------------------------------------------- */
    async MeterValues(payload, ctx) {
        // Standalone meter values (outside TransactionEvent). Update the active txn if present.
        const machine = await ensureMachine(ctx);
        if (!machine) return {};
        const reg = extractRegisterKwh(payload.meterValue);
        if (reg == null) return {};
        // We can't always map evse->txn here; update the machine's most recent active session.
        // (Best-effort: handled via TransactionEvent in normal flow.)
        return {};
    },
};

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
