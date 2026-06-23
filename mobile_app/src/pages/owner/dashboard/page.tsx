import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { ownerService, authService } from '../../../services/api';
import type { OwnerAnalytics, OwnerStation } from '../../../services/api/ownerService';
import {
  Building2, Cpu, Plug, Zap, PlusCircle, ChevronRight, MapPin, Loader2,
  TrendingUp, TrendingDown, IndianRupee, Database, BarChart3, Tag, Receipt,
} from 'lucide-react';

const inr = (n: number, dp = 2) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

// Small green/red/flat trend pill — matches the image's "▲ 0% vs yesterday"
function Trend({ pct, suffix = 'vs yesterday' }: { pct: number; suffix?: string }) {
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`owner-trend owner-trend-${dir}`}>
      <Icon size={11} /> {Math.abs(pct)}% <span className="owner-trend-sub">{suffix}</span>
    </span>
  );
}

const STATUS_LEGEND = [
  { key: 'active', label: 'Active', color: '#34D399' },
  { key: 'offline', label: 'Offline', color: '#6F8AA6' },
  { key: 'faulted', label: 'Faulted', color: '#FBBF24' },
  { key: 'maintenance', label: 'Maintenance', color: '#38BDF8' },
] as const;

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [a, setA] = useState<OwnerAnalytics | null>(null);
  const [stations, setStations] = useState<OwnerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [an, list] = await Promise.all([
        ownerService.getAnalytics(),
        ownerService.getMyStations().catch(() => []),
      ]);
      setA(an);
      setStations(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const hourly = a?.charts.hourly || [];
  const ss = a?.station_status || { active: 0, offline: 0, faulted: 0, maintenance: 0, total: 0 };

  const donutData = useMemo(() => {
    const segs = STATUS_LEGEND
      .map((s) => ({ name: s.label, value: (ss as any)[s.key] as number, color: s.color }))
      .filter((s) => s.value > 0);
    return segs.length ? segs : [{ name: 'None', value: 1, color: 'rgba(255,255,255,0.08)' }];
  }, [ss]);

  const statCards = [
    { key: 'stations', label: 'Stations', icon: Building2, tone: 'cyan', card: a?.cards.stations },
    { key: 'machines', label: 'Machines', icon: Cpu, tone: 'teal', card: a?.cards.machines },
    { key: 'connectors', label: 'Connectors', icon: Plug, tone: 'violet', card: a?.cards.connectors },
    { key: 'available', label: 'Available', icon: Zap, tone: 'green', card: a?.cards.available, suffix: 'available' as const },
  ];

  const pct = (v: number) => (ss.total > 0 ? Math.round((v / ss.total) * 100) : 0);

  if (loading) {
    return <div className="owner-page"><div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div></div>;
  }

  return (
    <div className="owner-page owner-animate-in">
      {/* Heading */}
      <div className="owner-page-head">
        <div className="owner-head-grow">
          <h1 className="owner-h1">Dashboard</h1>
          <p className="owner-sub">Welcome back, {user?.name || user?.nm_tx || 'Owner'} 👋</p>
        </div>
        <button className="owner-btn owner-btn-primary owner-btn-sm" onClick={() => navigate('/owner/stations/new')}>
          <PlusCircle size={16} /> Add Station
        </button>
      </div>

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

      {/* Stat cards */}
      <div className="owner-stats-grid">
        {statCards.map((c) => (
          <div key={c.key} className={`owner-stat-card tone-${c.tone}`}>
            <div className="owner-stat-icon"><c.icon size={18} /></div>
            <div className="owner-stat-value">{c.card?.value ?? 0}</div>
            <div className="owner-stat-label">{c.label}</div>
            <Trend pct={c.card?.trend_pct ?? 0} suffix={(c as any).suffix || 'vs yesterday'} />
          </div>
        ))}
      </div>

      {/* Today's revenue & consumption */}
      <div className="owner-chart-row">
        <div className="owner-card owner-chart-card">
          <div className="owner-chart-head">
            <span className="owner-chart-title">Today's Revenue</span>
            <span className="owner-chart-badge tone-green"><IndianRupee size={14} /></span>
          </div>
          <div className="owner-chart-value">₹{inr(a?.today.revenue ?? 0)}</div>
          <Trend pct={a?.today.revenue_trend_pct ?? 0} />
          <div className="owner-spark">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="revenue" stroke="#34D399" strokeWidth={2} fill="url(#gRev)" isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="owner-spark-axis"><span>00:00</span><span>12:00</span><span>24:00</span></div>
        </div>

        <div className="owner-card owner-chart-card">
          <div className="owner-chart-head">
            <span className="owner-chart-title">Today's Consumption</span>
            <span className="owner-chart-badge tone-cyan"><Zap size={14} /></span>
          </div>
          <div className="owner-chart-value">{inr(a?.today.consumption ?? 0)} <small>kWh</small></div>
          <Trend pct={a?.today.consumption_trend_pct ?? 0} />
          <div className="owner-spark">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="consumption" stroke="#38BDF8" strokeWidth={2} fill="url(#gCons)" isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="owner-spark-axis"><span>00:00</span><span>12:00</span><span>24:00</span></div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="owner-card owner-summary-tiles">
        <div className="owner-tile">
          <span className="owner-tile-icon tone-violet"><Database size={15} /></span>
          <div className="owner-tile-label">Total Revenue</div>
          <div className="owner-tile-value">₹{inr(a?.month.revenue ?? 0)}</div>
          <div className="owner-tile-sub">This Month</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-green"><BarChart3 size={15} /></span>
          <div className="owner-tile-label">Total Consumption</div>
          <div className="owner-tile-value">{inr(a?.month.consumption ?? 0)} <small>kWh</small></div>
          <div className="owner-tile-sub">This Month</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-amber"><Tag size={15} /></span>
          <div className="owner-tile-label">Avg. Revenue / kWh</div>
          <div className="owner-tile-value">₹{inr(a?.month.avg_revenue_per_kwh ?? 0)}</div>
          <div className="owner-tile-sub">This Month</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-cyan"><Receipt size={15} /></span>
          <div className="owner-tile-label">Transactions</div>
          <div className="owner-tile-value">{a?.month.transactions_today ?? 0}</div>
          <div className="owner-tile-sub">Today</div>
        </div>
      </div>

      {/* Station status */}
      <div className="owner-section-head">
        <h2 className="owner-h2">Station Status</h2>
        <button className="owner-view-all" onClick={() => navigate('/owner/stations')}>View all</button>
      </div>
      <div className="owner-card owner-status-card">
        <div className="owner-donut-wrap">
          <div className="owner-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" innerRadius={42} outerRadius={58} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="owner-donut-center">
              <strong>{ss.total}</strong>
              <span>Total</span>
            </div>
          </div>
          <div className="owner-status-legend">
            {STATUS_LEGEND.map((s) => {
              const v = (ss as any)[s.key] as number;
              return (
                <div key={s.key} className="owner-legend-row">
                  <span className="owner-legend-dot" style={{ background: s.color }} />
                  <span className="owner-legend-label">{s.label}</span>
                  <span className="owner-legend-val">{v} ({pct(v)}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {stations[0] && (
          <button className="owner-status-station" onClick={() => navigate(`/owner/stations/${stations[0].station_id}`)}>
            <div className="owner-ss-top">
              <span className="owner-ss-name">{stations[0].name}</span>
              <span className={`owner-chip owner-status-${stations[0].approval_status}`}>{stations[0].approval_status}</span>
            </div>
            {stations[0].is_fast_charging && <span className="owner-tag owner-tag-fast"><Zap size={11} /> Fast</span>}
            <div className="owner-ss-meta"><MapPin size={12} /> {stations[0].city || stations[0].address}</div>
            <div className="owner-ss-meta"><IndianRupee size={12} /> {stations[0].price_per_kwh}/kWh</div>
            <div className="owner-ss-chips">
              <span><Cpu size={12} /> {stations[0].machine_count ?? 0} Machines</span>
              <span><Plug size={12} /> {stations[0].connector_count ?? 0} Connectors</span>
            </div>
          </button>
        )}
      </div>

      {/* Recent transactions */}
      <div className="owner-section-head">
        <h2 className="owner-h2">Recent Transactions</h2>
        <button className="owner-view-all" onClick={() => navigate('/owner/transactions')}>View all</button>
      </div>
      {(a?.recent_transactions.length ?? 0) === 0 ? (
        <div className="owner-card owner-txn-empty"><Receipt size={20} /> No transactions yet</div>
      ) : (
        <div className="owner-card owner-txn-list">
          {a!.recent_transactions.map((t, i) => (
            <div key={t.code + i} className="owner-txn-row">
              <span className="owner-txn-icon"><Zap size={16} /></span>
              <div className="owner-txn-main">
                <div className="owner-txn-code">{t.code}</div>
                <div className="owner-txn-sub">{t.station}{t.connector ? ` • ${t.connector}` : ''}</div>
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
