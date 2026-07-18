import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerService } from '../../../services/api';
import type { OwnerEarnings, OwnerSettlements, EarningsPeriod } from '../../../services/api/ownerService';
import {
  ArrowLeft, Loader2, Wallet, Hourglass, Info, CheckCircle2, Clock, XCircle, Receipt, Zap,
} from 'lucide-react';

const inr = (n?: number | null, dp = 2) =>
  (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

type Tab = 'today' | 'month' | 'lifetime';
const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This Month' },
  { key: 'lifetime', label: 'Lifetime' },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'settled') return <CheckCircle2 size={13} />;
  if (status === 'failed') return <XCircle size={13} />;
  return <Clock size={13} />;
}

export default function OwnerEarningsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('month');
  const [e, setE] = useState<OwnerEarnings | null>(null);
  const [s, setS] = useState<OwnerSettlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [earn, setl] = await Promise.all([
          ownerService.getEarnings(),
          ownerService.getSettlements().catch(() => null),
        ]);
        setE(earn);
        setS(setl);
      } catch (err: any) {
        setError(err?.message || 'Failed to load earnings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="owner-page"><div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div></div>;
  }
  if (error || !e) {
    return (
      <div className="owner-page">
        <div className="owner-page-head">
          <button className="owner-back" onClick={() => navigate('/owner')}><ArrowLeft size={18} /></button>
          <div className="owner-head-grow"><h1 className="owner-h1">Earnings &amp; Payouts</h1></div>
        </div>
        <div className="owner-alert owner-alert-error">{error || 'No earnings data'}</div>
      </div>
    );
  }

  const p: EarningsPeriod = e[tab];
  const hasTax = e.commission.tax_pct > 0;

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <button className="owner-back" onClick={() => navigate('/owner')}><ArrowLeft size={18} /></button>
        <div className="owner-head-grow"><h1 className="owner-h1">Earnings &amp; Payouts</h1></div>
      </div>

      <div className="owner-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`owner-tab ${tab === t.key ? 'owner-tab-on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reads as one subtraction: billed − DJT Share = total earned. Both
          operands come from the ledger, so the figures reconcile exactly. */}
      <div className="owner-card owner-breakdown">
        <div className="owner-bd-row">
          {/* Tariffs are stored GST-inclusive, so this figure already contains GST. */}
          <span>Billed to drivers <small>(incl. GST)</small></span>
          <span>₹{inr(p.billed)}</span>
        </div>
        <div className="owner-bd-row owner-bd-neg">
          <span>
            DJT Share
            {e.commission.platform_pct != null && <small> ({e.commission.platform_pct}%)</small>}
          </span>
          <span>−₹{inr(p.commission)}</span>
        </div>
        {hasTax && (
          <div className="owner-bd-row owner-bd-neg">
            <span>Tax ({e.commission.tax_pct}%)</span>
            <span>—</span>
          </div>
        )}
        <div className="owner-bd-row owner-bd-total owner-bd-grand">
          <span>Total earned</span>
          <span>₹{inr(p.total_earned)}</span>
        </div>

        {/* Where that total came from. Only worth splitting out when some of it
            bypassed the platform. */}
        {p.direct_collected > 0 && (
          <div className="owner-bd-sub">
            <div className="owner-bd-row">
              <span>via platform (settled)</span>
              <span>₹{inr(p.net)}</span>
            </div>
            <div className="owner-bd-row owner-bd-plus">
              <span><Zap size={12} /> collected at machine</span>
              <span>₹{inr(p.direct_collected)}</span>
            </div>
          </div>
        )}

        {p.direct_collected > 0 && (
          <p className="owner-bd-note">
            <Info size={12} /> Energy delivered beyond the driver's prepaid hold is collected at the
            machine and never passes through the platform, so no DJT Share is deducted from it.
          </p>
        )}
      </div>

      <p className="owner-rate-note">
        <Info size={12} /> Your share {e.commission.owner_pct ?? '—'}% · DJT Share {e.commission.platform_pct ?? '—'}%
        {e.commission.scope && <small> ({e.commission.scope} rule)</small>}
      </p>
      {e.commission.station_overrides.length > 0 && (
        <div className="owner-card owner-overrides">
          <div className="owner-overrides-title">Station-specific rates</div>
          {e.commission.station_overrides.map((o) => (
            <div key={o.station_id} className="owner-override-row">
              <span>{o.station}</span>
              <span>{o.owner_pct}% / {o.platform_pct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Balance */}
      <h2 className="owner-h2 owner-mt">Balance</h2>
      <div className="owner-card owner-balance-card">
        <div className="owner-bal-row">
          <span><Wallet size={14} /> Available for payout</span>
          <strong>₹{inr(e.balance.available)}</strong>
        </div>
        <div className="owner-bal-row">
          <span><Hourglass size={14} /> Held in escrow
            {e.balance.active_sessions > 0 && <small> ({e.balance.active_sessions} active)</small>}
          </span>
          <strong>₹{inr(e.balance.in_escrow)}</strong>
        </div>
        {s && s.pending_net > 0 && (
          <div className="owner-bal-row">
            <span><Clock size={14} /> Pending settlement</span>
            <strong>₹{inr(s.pending_net)}</strong>
          </div>
        )}
        {e.refunds.month > 0 && (
          <div className="owner-bal-row owner-bal-muted">
            <span>Refunded to drivers (this month)</span>
            <strong>₹{inr(e.refunds.month)}</strong>
          </div>
        )}
      </div>

      {/* Payout history */}
      <h2 className="owner-h2 owner-mt">Payout History</h2>
      {!s || s.settlements.length === 0 ? (
        <div className="owner-card owner-txn-empty">
          <Receipt size={20} />
          <div>
            No payouts yet
            <small>Your net earnings accrue in the balance above until a settlement is raised.</small>
          </div>
        </div>
      ) : (
        <div className="owner-card owner-payout-list">
          {s.settlements.map((st) => (
            <div key={st.settlement_id} className="owner-payout-row">
              <div className="owner-payout-top">
                <span className="owner-payout-period">
                  {fmtDate(st.period_from)} – {fmtDate(st.period_to)}
                </span>
                <span className={`owner-chip owner-settle-${st.status}`}>
                  <StatusIcon status={st.status} /> {st.status}
                </span>
              </div>
              <div className="owner-payout-net">Net ₹{inr(st.net)}</div>
              <div className="owner-payout-meta">
                <span>Gross ₹{inr(st.gross)}</span>
                <span>DJT Share ₹{inr(st.commission)}</span>
                {st.tax > 0 && <span>Tax ₹{inr(st.tax)}</span>}
              </div>
              {st.utr && <div className="owner-payout-utr">UTR {st.utr}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="owner-bottom-space" />
    </div>
  );
}
