import { useEffect, useMemo, useState } from 'react';
import { ownerService } from '../../../services/api';
import type { OwnerTransaction } from '../../../services/api/ownerService';
import { Zap, Loader2, Receipt, User } from 'lucide-react';

const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'active', label: 'Active' },
  { key: 'failed', label: 'Failed' },
] as const;

function fmtDate(d: string | null) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
    ', ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function OwnerTransactionsPage() {
  const [txns, setTxns] = useState<OwnerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        setTxns(await ownerService.getTransactions(100));
      } catch (e: any) {
        setError(e?.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? txns : txns.filter((t) => t.status === filter)),
    [txns, filter],
  );

  const totalRevenue = useMemo(
    () => txns.filter((t) => t.status === 'completed').reduce((s, t) => s + t.cost, 0),
    [txns],
  );

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <div className="owner-head-grow">
          <h1 className="owner-h1">Transactions</h1>
          <p className="owner-sub">{txns.length} sessions · ₹{inr(totalRevenue)} earned</p>
        </div>
      </div>

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

      <div className="owner-filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`owner-filter-chip${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="owner-card owner-txn-empty"><Receipt size={20} /> No transactions{filter !== 'all' ? ` (${filter})` : ''} yet</div>
      ) : (
        <div className="owner-card owner-txn-list">
          {filtered.map((t, i) => (
            <div key={t.code + i} className="owner-txn-row">
              <span className="owner-txn-icon"><Zap size={16} /></span>
              <div className="owner-txn-main">
                <div className="owner-txn-code">{t.code}</div>
                <div className="owner-txn-sub">{t.station}{t.connector ? ` • ${t.connector}` : ''}</div>
                <div className="owner-txn-sub owner-txn-when">
                  {t.customer && <><User size={11} /> {t.customer} · </>}{fmtDate(t.date)}
                </div>
              </div>
              <div className="owner-txn-right">
                <div className="owner-txn-cost">₹{inr(t.cost)}</div>
                <div className="owner-txn-meta">
                  {t.energy_kwh} kWh{t.duration_min != null ? ` • ${t.duration_min} min` : ''}
                </div>
                <div className={`owner-txn-status owner-status-${t.status}`}>{t.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="owner-bottom-space" />
    </div>
  );
}
