import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ownerService } from '../../../services/api';
import type { StationBreakdown, StationBreakdownRow } from '../../../services/api/ownerService';
import { ArrowLeft, Loader2, AlertTriangle, Building2, ChevronRight } from 'lucide-react';

const inr = (n?: number | null, dp = 2) =>
  (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const COLORS = ['#34D399', '#38BDF8', '#A78BFA', '#FBBF24', '#F472B6', '#6F8AA6'];

type Range = 'today' | 'month' | 'lifetime';
type GroupBy = 'station' | 'city' | 'operator';
type SortBy = 'net' | 'consumption' | 'transactions' | 'utilisation_pct';

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// 'lifetime' is resolved server-side from the owner's first session/station,
// so utilisation is divided by a real window rather than an arbitrary epoch.
function rangeArg(r: Range): { from: string; to: string } | 'lifetime' {
  if (r === 'lifetime') return 'lifetime';
  const now = new Date();
  const to = iso(now);
  if (r === 'today') return { from: to, to };
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
}

const RANGE_LABEL: Record<Range, string> = { today: 'Today', month: 'Month', lifetime: 'Lifetime' };

const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const SORTS: { key: SortBy; label: string }[] = [
  { key: 'net', label: 'Net' },
  { key: 'consumption', label: 'kWh' },
  { key: 'transactions', label: 'Txns' },
  { key: 'utilisation_pct', label: 'Util' },
];

/** A row in the table — either a station, or several stations rolled up by city/operator. */
interface Group {
  key: string;
  label: string;
  stationId: number | null;
  net: number;
  consumption: number;
  transactions: number;
  utilisation_pct: number;
  share_pct: number;
}

function groupRows(rows: StationBreakdownRow[], by: GroupBy, days: number): Group[] {
  if (by === 'station') {
    return rows.map((s) => ({
      key: `s${s.station_id}`, label: s.name, stationId: s.station_id,
      net: s.net, consumption: s.consumption, transactions: s.transactions,
      utilisation_pct: s.utilisation_pct, share_pct: s.share_pct,
    }));
  }
  const bucket = new Map<string, Group & { _mins: number; _machines: number }>();
  rows.forEach((s) => {
    const label = (by === 'city' ? s.city : s.operator) || 'Unassigned';
    const g = bucket.get(label) || {
      key: label, label, stationId: null, net: 0, consumption: 0,
      transactions: 0, utilisation_pct: 0, share_pct: 0, _mins: 0, _machines: 0,
    };
    g.net += s.net;
    g.consumption += s.consumption;
    g.transactions += s.transactions;
    g._mins += s.charge_minutes;
    g._machines += s.machines;
    bucket.set(label, g);
  });
  const totalNet = rows.reduce((a, s) => a + s.net, 0);
  return [...bucket.values()].map((g) => ({
    ...g,
    // Recompute utilisation over the group's combined machine capacity across
    // the whole window, rather than averaging per-station percentages (which
    // would weight a 1-machine station the same as a 10-machine one).
    utilisation_pct: g._machines > 0
      ? Math.round((g._mins / (g._machines * days * 24 * 60)) * 1000) / 10
      : 0,
    share_pct: totalNet > 0 ? Math.round((g.net / totalNet) * 1000) / 10 : 0,
  }));
}

export default function OwnerStationAnalyticsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('station');
  const [sortBy, setSortBy] = useState<SortBy>('net');
  const [data, setData] = useState<StationBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        setData(await ownerService.getStationBreakdown(rangeArg(range)));
      } catch (e: any) {
        setError(e?.message || 'Failed to load station analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  const rows = useMemo(() => {
    if (!data) return [];
    const g = groupRows(data.stations, groupBy, data.range.days);
    return g.sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
  }, [data, groupBy, sortBy]);

  const donut = useMemo(() => {
    const withNet = rows.filter((r) => r.net > 0);
    if (!withNet.length) return [{ name: 'No revenue', value: 1, color: 'rgba(255,255,255,0.08)' }];
    const top = withNet.slice(0, 5).map((r, i) => ({ name: r.label, value: r.net, color: COLORS[i % COLORS.length] }));
    const rest = withNet.slice(5).reduce((a, r) => a + r.net, 0);
    return rest > 0 ? [...top, { name: 'Others', value: rest, color: COLORS[5] }] : top;
  }, [rows]);

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <button className="owner-back" onClick={() => navigate('/owner')}><ArrowLeft size={18} /></button>
        <div className="owner-head-grow"><h1 className="owner-h1">Station Analytics</h1></div>
      </div>

      <div className="owner-filters">
        <div className="owner-filter-group">
          <span className="owner-filter-label">Range</span>
          <div className="owner-seg">
            {(['today', 'month', 'lifetime'] as Range[]).map((r) => (
              <button key={r} className={`owner-seg-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="owner-filter-group">
          <span className="owner-filter-label">Group</span>
          <div className="owner-seg">
            {(['station', 'city', 'operator'] as GroupBy[]).map((g) => (
              <button key={g} className={`owner-seg-btn ${groupBy === g ? 'active' : ''}`} onClick={() => setGroupBy(g)}>
                {g[0].toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

      {loading ? (
        <div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div>
      ) : !data || data.stations.length === 0 ? (
        <div className="owner-card owner-txn-empty"><Building2 size={20} /> No stations yet</div>
      ) : (
        <>
          <div className="owner-range-caption">
            {data.range.lifetime
              ? `All activity since ${fmtDay(data.range.from)} (${data.range.days} days)`
              : `${fmtDay(data.range.from)} – ${fmtDay(data.range.to)}`}
          </div>

          <div className="owner-card owner-share-card">
            <div className="owner-share-title">Net revenue share</div>
            <div className="owner-share-body">
              <div className="owner-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius={42} outerRadius={58} paddingAngle={2}
                      stroke="none" startAngle={90} endAngle={-270}>
                      {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="owner-donut-center">
                  <strong>₹{inr(data.totals.net, 0)}</strong>
                  <span>Net</span>
                </div>
              </div>
              <div className="owner-status-legend">
                {donut.map((d, i) => (
                  <div key={i} className="owner-legend-row">
                    <span className="owner-legend-dot" style={{ background: d.color }} />
                    <span className="owner-legend-label">{d.name}</span>
                    <span className="owner-legend-val">
                      {data.totals.net > 0 ? Math.round((d.value / data.totals.net) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="owner-sort-row">
            <span className="owner-filter-label">Sort by</span>
            <div className="owner-seg">
              {SORTS.map((s) => (
                <button key={s.key} className={`owner-seg-btn ${sortBy === s.key ? 'active' : ''}`} onClick={() => setSortBy(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="owner-card owner-sa-table">
            <div className="owner-sa-thead">
              <span>{groupBy === 'station' ? 'Station' : groupBy === 'city' ? 'City' : 'Operator'}</span>
              <span>Net</span>
              <span>kWh</span>
              <span>Txn</span>
              <span>Util</span>
            </div>
            {rows.map((r) => (
              <button
                key={r.key}
                className="owner-sa-trow"
                disabled={r.stationId == null}
                onClick={() => r.stationId != null && navigate(`/owner/stations/${r.stationId}`)}
              >
                <span className="owner-sa-tname">
                  {r.label}
                  {r.stationId != null && <ChevronRight size={13} />}
                </span>
                <span>₹{inr(r.net, 0)}</span>
                <span>{inr(r.consumption, 1)}</span>
                <span>{r.transactions}</span>
                <span>{r.utilisation_pct}%</span>
              </button>
            ))}
            <div className="owner-sa-tfoot">
              <span>Total</span>
              <span>₹{inr(data.totals.net, 0)}</span>
              <span>{inr(data.totals.consumption, 1)}</span>
              <span>{data.totals.transactions}</span>
              <span>{data.totals.utilisation_pct}%</span>
            </div>
          </div>

          {data.attention.length > 0 && (
            <>
              <h2 className="owner-h2 owner-mt">Needs attention</h2>
              <div className="owner-card owner-attention-list">
                {data.attention.map((x, i) => (
                  <button key={i} className="owner-attn-row" onClick={() => navigate(`/owner/stations/${x.station_id}`)}>
                    <AlertTriangle size={14} />
                    <div>
                      <strong>{x.station}</strong>
                      <span>{x.message}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="owner-bottom-space" />
    </div>
  );
}
