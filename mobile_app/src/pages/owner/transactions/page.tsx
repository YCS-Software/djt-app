import { useEffect, useMemo, useState } from 'react';
import { ownerService } from '../../../services/api';
import type { OwnerTransaction } from '../../../services/api/ownerService';
import { Zap, Loader2, Receipt, User, Calendar } from 'lucide-react';

const inr = (n?: number | null) => (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * sssn_lst_t.sttus_cd is one of: initiated, active, completed, cancelled, failed.
 * A chip matches a *set* of codes — an in-progress session is 'initiated' until
 * the charger reports, and an aborted one is 'cancelled', not 'failed'. Matching
 * a single code per chip left those sessions unreachable.
 */
const FILTERS: { key: string; label: string; match: string[] | null }[] = [
  { key: 'all', label: 'All', match: null },
  { key: 'active', label: 'In progress', match: ['initiated', 'active'] },
  { key: 'completed', label: 'Completed', match: ['completed'] },
  { key: 'cancelled', label: 'Cancelled', match: ['cancelled'] },
  { key: 'failed', label: 'Failed', match: ['failed'] },
];

const matcher = (key: string) => FILTERS.find((f) => f.key === key)?.match ?? null;

type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom';

const DATE_FILTERS: { key: DateRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Resolved client-side, then applied server-side so "All time" really is all.
function dateWindow(r: DateRange, custom: { from: string; to: string }) {
  const now = new Date();
  const to = iso(now);
  switch (r) {
    case 'today': return { from: to, to };
    case 'week': return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to };
    case 'month': return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    case 'custom': return custom.from && custom.to ? custom : undefined;
    case 'all':
    default: return undefined;
  }
}

function fmtDate(d: string | null) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Group transactions under their calendar day, newest first.
function groupByDay(txns: OwnerTransaction[]) {
  const groups: { day: string; items: OwnerTransaction[] }[] = [];
  txns.forEach((t) => {
    const d = t.date ? new Date(t.date) : null;
    const day = d && !isNaN(d.getTime())
      ? d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      : 'Unknown date';
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(t);
    else groups.push({ day, items: [t] });
  });
  return groups;
}

export default function OwnerTransactionsPage() {
  const [txns, setTxns] = useState<OwnerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const window_ = dateWindow(dateRange, custom);

  useEffect(() => {
    // A custom range with only one bound set isn't a query yet — wait for both.
    if (dateRange === 'custom' && !window_) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        setTxns(await ownerService.getTransactions(200, window_));
      } catch (e: any) {
        setError(e?.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, custom.from, custom.to]);

  const filtered = useMemo(() => {
    const match = matcher(filter);
    return match ? txns.filter((t) => match.includes(t.status)) : txns;
  }, [txns, filter]);

  // Chip counts, so an empty bucket is visible before you tap it.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    FILTERS.forEach((f) => {
      c[f.key] = f.match ? txns.filter((t) => f.match!.includes(t.status)).length : txns.length;
    });
    return c;
  }, [txns]);

  // "Earned" is the owner's net share, not what the driver paid.
  const totalNet = useMemo(
    () => txns.filter((t) => t.status === 'completed').reduce((s, t) => s + (t.net ?? 0), 0),
    [txns],
  );

  const dayGroups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <div className="owner-head-grow">
          <h1 className="owner-h1">Transactions</h1>
          <p className="owner-sub">
            {txns.length} sessions · ₹{inr(totalNet)} net earned
            {window_ && <> · {DATE_FILTERS.find((d) => d.key === dateRange)?.label.toLowerCase()}</>}
          </p>
        </div>
      </div>

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

      <div className="owner-txn-filters">
        <span className="owner-filter-label">Date</span>
        <div className="owner-filter-row">
          {DATE_FILTERS.map((d) => (
            <button
              key={d.key}
              className={`owner-filter-chip${dateRange === d.key ? ' active' : ''}`}
              onClick={() => setDateRange(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div className="owner-date-inputs">
            <input
              className="owner-input" type="date" value={custom.from} max={custom.to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <span>to</span>
            <input
              className="owner-input" type="date" value={custom.to} min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
        )}

        <span className="owner-filter-label">Status</span>
        <div className="owner-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`owner-filter-chip${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="owner-chip-count">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div>
      ) : dateRange === 'custom' && !window_ ? (
        <div className="owner-card owner-txn-empty"><Calendar size={20} /> Pick a start and end date</div>
      ) : filtered.length === 0 ? (
        <div className="owner-card owner-txn-empty">
          <Receipt size={20} />
          No {filter !== 'all' ? FILTERS.find((f) => f.key === filter)?.label.toLowerCase() : ''} transactions
          {window_ ? ' in this date range' : ' yet'}
        </div>
      ) : (
        dayGroups.map((g) => (
          <div key={g.day} className="owner-txn-day">
            <div className="owner-txn-day-head">
              <Calendar size={12} /> {g.day}
              <span className="owner-txn-day-count">{g.items.length}</span>
            </div>
            <div className="owner-card owner-txn-list">
              {g.items.map((t, i) => (
                <div key={t.code + i} className="owner-txn-card">
                  <div className="owner-txn-row">
                    <span className="owner-txn-icon"><Zap size={16} /></span>
                    <div className="owner-txn-main">
                      <div className="owner-txn-code">{t.code}</div>
                      <div className="owner-txn-sub">{t.station}{t.connector ? ` • ${t.connector}` : ''}</div>
                      <div className="owner-txn-sub owner-txn-when">
                        {t.customer && <><User size={11} /> {t.customer} · </>}{fmtDate(t.date)}
                      </div>
                      <div className="owner-txn-meta">
                        {t.energy_kwh} kWh{t.duration_min != null ? ` • ${t.duration_min} min` : ''}
                      </div>
                    </div>
                    <div className="owner-txn-right">
                      <div className="owner-txn-cost">₹{inr(t.net ?? 0)} <small>net</small></div>
                      <div className="owner-txn-badges">
                        <span className={`owner-txn-status owner-status-${t.status}`}>{t.status}</span>
                        {t.payment_status && (
                          <span className={`owner-txn-status owner-pay-${t.payment_status}`}>{t.payment_status}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* How the driver's payment was split. Percentages come from the
                      amounts actually posted to the ledger, so they reconcile exactly. */}
                  {t.settled > 0 && (
                    <div className="owner-split">
                      <div className="owner-split-bar">
                        <div className="owner-split-owner" style={{ width: `${t.owner_pct ?? 0}%` }} />
                        <div className="owner-split-platform" style={{ width: `${t.platform_pct ?? 0}%` }} />
                      </div>
                      <div className="owner-split-rows">
                        <div className="owner-split-row">
                          <span className="owner-split-k"><i className="owner-dot owner-dot-owner" /> Your share</span>
                          <span className="owner-split-pct">{t.owner_pct}%</span>
                          <span className="owner-split-amt">₹{inr(t.net)}</span>
                        </div>
                        <div className="owner-split-row">
                          <span className="owner-split-k"><i className="owner-dot owner-dot-platform" /> DJT Share</span>
                          <span className="owner-split-pct">{t.platform_pct}%</span>
                          <span className="owner-split-amt">−₹{inr(t.commission)}</span>
                        </div>
                        {t.direct_collected > 0 && (
                          <div className="owner-split-row owner-split-direct">
                            <span className="owner-split-k"><i className="owner-dot owner-dot-direct" /> Collected at machine</span>
                            <span className="owner-split-pct">100%</span>
                            <span className="owner-split-amt">+₹{inr(t.direct_collected)}</span>
                          </div>
                        )}
                        <div className="owner-split-row owner-split-total">
                          {/* Tariffs are GST-inclusive, so the billed figure contains GST. */}
                          <span className="owner-split-k">Driver billed <small>(incl. GST)</small></span>
                          <span className="owner-split-pct" />
                          <span className="owner-split-amt">₹{inr(t.cost)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      <div className="owner-bottom-space" />
    </div>
  );
}
