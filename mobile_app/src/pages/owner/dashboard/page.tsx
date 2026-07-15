import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { ownerService, authService } from '../../../services/api';
import type {
  OwnerAnalytics, OwnerStation, OwnerEarnings, StationBreakdown,
} from '../../../services/api/ownerService';
import {
  Building2, Cpu, Plug, Zap, PlusCircle, MapPin, Loader2, AlertTriangle,
  TrendingUp, TrendingDown, IndianRupee, Database, BarChart3, Tag, Receipt,
  Wallet, Hourglass, ArrowRight,
} from 'lucide-react';

const inr = (n: number, dp = 2) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

// Small green/red/flat trend pill — matches the image's "▲ 0% vs yesterday"
function Trend({ pct, suffix = 'vs yesterday' }: { pct: number; suffix?: string }) {
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  // A flat 0% gets no arrow at all; only a real move earns a direction.
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : null;
  return (
    <span className={`owner-trend owner-trend-${dir}`}>
      {Icon && <Icon size={11} />} {Math.abs(pct)}% <span className="owner-trend-sub">{suffix}</span>
    </span>
  );
}

// A plain ratio (e.g. "60% available") — deliberately not a Trend, since it
// describes a share of a total rather than a change over time.
function Ratio({ pct, label }: { pct: number; label: string }) {
  return <span className="owner-ratio">{pct}% <span className="owner-trend-sub">{label}</span></span>;
}

const STATUS_LEGEND = [
  { key: 'active', label: 'Active', color: '#34D399' },
  { key: 'offline', label: 'Offline', color: '#6F8AA6' },
  { key: 'faulted', label: 'Faulted', color: '#FBBF24' },
  { key: 'maintenance', label: 'Maintenance', color: '#38BDF8' },
] as const;

const SHARE_COLORS = ['#34D399', '#38BDF8', '#A78BFA', '#FBBF24', '#F472B6'];

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [a, setA] = useState<OwnerAnalytics | null>(null);
  const [earnings, setEarnings] = useState<OwnerEarnings | null>(null);
  const [breakdown, setBreakdown] = useState<StationBreakdown | null>(null);
  const [stations, setStations] = useState<OwnerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // Analytics is the only hard dependency; the rest degrade to null/[] so a
      // single failing panel never blanks the whole dashboard.
      const [an, earn, brk, list] = await Promise.all([
        ownerService.getAnalytics(),
        ownerService.getEarnings().catch(() => null),
        ownerService.getStationBreakdown().catch(() => null),
        ownerService.getMyStations().catch(() => []),
      ]);
      setA(an);
      setEarnings(earn);
      setBreakdown(brk);
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
  ];

  const pct = (v: number) => (ss.total > 0 ? Math.round((v / ss.total) * 100) : 0);

  // Top stations by net; the drill-down page shows the rest.
  const topStations = useMemo(() => (breakdown?.stations || []).slice(0, 4), [breakdown]);
  const attention = breakdown?.attention || [];
  const month = earnings?.month;

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

      {/* Net earnings — the money the owner actually receives, after commission.
          Gross is kept as context (GST filing, reconciling driver receipts). */}
      {month && (
        <div className="owner-card owner-earnings-hero">
          <div className="owner-eh-head">
            <span className="owner-eh-title"><Wallet size={14} /> Net Earnings</span>
            <span className="owner-eh-period">This Month</span>
          </div>

          {/* Headline is everything the owner keeps, so that
              billed − DJT Share = this number, exactly. */}
          <div className="owner-eh-value">₹{inr(month.total_earned)}</div>
          <Trend pct={month.net_trend_pct ?? 0} suffix="vs last month" />

          <div className="owner-eh-split">
            <div>
              {/* Tariffs are stored GST-inclusive, so billed already contains GST. */}
              <span className="owner-eh-k">Billed (incl. GST)</span>
              <span className="owner-eh-v">₹{inr(month.billed)}</span>
            </div>
            <div>
              <span className="owner-eh-k">DJT Share</span>
              <span className="owner-eh-v owner-eh-neg">
                −₹{inr(month.commission)}
                {earnings?.commission.platform_pct != null && (
                  <small> ({earnings.commission.platform_pct}%)</small>
                )}
              </span>
            </div>
          </div>

          {month.direct_collected > 0 && (
            <div className="owner-eh-direct">
              <Zap size={12} /> Includes ₹{inr(month.direct_collected)} collected at the machine
              <small> — beyond the prepaid hold, no DJT Share taken</small>
            </div>
          )}

          <div className="owner-eh-balance">
            <div>
              <span className="owner-eh-bk"><Wallet size={12} /> Available</span>
              <strong>₹{inr(earnings!.balance.available)}</strong>
            </div>
            <div>
              <span className="owner-eh-bk"><Hourglass size={12} /> In escrow</span>
              <strong>₹{inr(earnings!.balance.in_escrow)}</strong>
              {earnings!.balance.active_sessions > 0 && (
                <small>{earnings!.balance.active_sessions} active</small>
              )}
            </div>
          </div>

          {earnings && (
            <div className="owner-eh-lifetime">
              <span className="owner-eh-bk">All-time earned</span>
              <strong>₹{inr(earnings.lifetime.total_earned)}</strong>
              <small>billed ₹{inr(earnings.lifetime.billed)} · DJT Share ₹{inr(earnings.lifetime.commission)}</small>
            </div>
          )}

          <button className="owner-eh-cta" onClick={() => navigate('/owner/earnings')}>
            View earnings &amp; payouts <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="owner-stats-grid">
        {statCards.map((c) => (
          <div key={c.key} className={`owner-stat-card tone-${c.tone}`}>
            <div className="owner-stat-icon"><c.icon size={18} /></div>
            <div className="owner-stat-value">{c.card?.value ?? 0}</div>
            <div className="owner-stat-label">{c.label}</div>
            <Trend pct={c.card?.trend_pct ?? 0} />
          </div>
        ))}
        <div className="owner-stat-card tone-green">
          <div className="owner-stat-icon"><Zap size={18} /></div>
          <div className="owner-stat-value">{a?.cards.available.value ?? 0}</div>
          <div className="owner-stat-label">Available</div>
          <Ratio pct={a?.cards.available.ratio_pct ?? 0} label={`of ${a?.cards.machines.value ?? 0} machines`} />
        </div>
      </div>

      {/* Today's revenue & consumption */}
      <div className="owner-chart-row">
        <div className="owner-card owner-chart-card">
          <div className="owner-chart-head">
            <span className="owner-chart-title">Today's Net</span>
            <span className="owner-chart-badge tone-green"><IndianRupee size={14} /></span>
          </div>
          <div className="owner-chart-value">₹{inr(a?.today.total_earned ?? 0)}</div>
          <Trend pct={a?.today.net_trend_pct ?? 0} />
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
          <div className="owner-chart-foot">billed ₹{inr(a?.today.billed ?? 0)}</div>
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

      {/* Summary tiles — all four are month-to-date, and now all four say so. */}
      <div className="owner-card owner-summary-tiles">
        <div className="owner-tile">
          <span className="owner-tile-icon tone-violet"><Database size={15} /></span>
          <div className="owner-tile-label">Net Earned</div>
          <div className="owner-tile-value">₹{inr(a?.month.total_earned ?? 0)}</div>
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
          <div className="owner-tile-label">Avg. Net / kWh</div>
          <div className="owner-tile-value">₹{inr(a?.month.avg_net_per_kwh ?? 0)}</div>
          <div className="owner-tile-sub">This Month</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-cyan"><Receipt size={15} /></span>
          <div className="owner-tile-label">Transactions</div>
          <div className="owner-tile-value">{a?.month.transactions ?? 0}</div>
          <div className="owner-tile-sub">This Month</div>
        </div>
      </div>

      {/* Station-wise analytics */}
      <div className="owner-section-head">
        <h2 className="owner-h2">Station Analytics</h2>
        <button className="owner-view-all" onClick={() => navigate('/owner/analytics/stations')}>View all</button>
      </div>

      {attention.length > 0 && (
        <div className="owner-alert owner-alert-warning owner-attention">
          <AlertTriangle size={15} />
          <div>
            {attention.slice(0, 2).map((x, i) => (
              <div key={i}><strong>{x.station}</strong> — {x.message}</div>
            ))}
            {attention.length > 2 && <div className="owner-attention-more">+{attention.length - 2} more</div>}
          </div>
        </div>
      )}

      {topStations.length === 0 ? (
        <div className="owner-card owner-txn-empty"><Building2 size={20} /> No station activity yet</div>
      ) : (
        <div className="owner-card owner-station-analytics">
          {topStations.map((s, i) => (
            <button key={s.station_id} className="owner-sa-row" onClick={() => navigate(`/owner/stations/${s.station_id}`)}>
              <div className="owner-sa-top">
                <span className="owner-sa-rank">{i + 1}</span>
                <span className="owner-sa-name">{s.name}</span>
                {s.faulted_machines > 0
                  ? <span className="owner-chip owner-status-faulted">{s.faulted_machines} faulted</span>
                  : <span className={`owner-chip owner-status-${s.approval_status}`}>{s.approval_status}</span>}
              </div>
              <div className="owner-sa-money">
                <strong>₹{inr(s.net)}</strong> <span>net</span>
                {/* null on a lifetime window — no prior period to compare against */}
                {s.net_trend_pct != null && <Trend pct={s.net_trend_pct} suffix="vs prev period" />}
              </div>
              <div className="owner-sa-bar">
                <div style={{ width: `${s.share_pct}%`, background: SHARE_COLORS[i % SHARE_COLORS.length] }} />
              </div>
              <div className="owner-sa-meta">
                <span>{s.share_pct}% share</span>
                <span>{inr(s.consumption, 2)} kWh</span>
                <span>{s.transactions} txn</span>
                <span>util {s.utilisation_pct}%</span>
              </div>
            </button>
          ))}
          {(breakdown?.stations.length ?? 0) > topStations.length && (
            <button className="owner-sa-more" onClick={() => navigate('/owner/analytics/stations')}>
              View all {breakdown!.stations.length} stations <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

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
              <span>Stations</span>
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
            <div className="owner-ss-meta"><IndianRupee size={12} /> {stations[0].price_per_kwh}/kWh <small>incl. GST</small></div>
            <div className="owner-ss-chips">
              <span><Cpu size={12} /> {stations[0].machine_count ?? 0} Machines</span>
              <span><Plug size={12} /> {stations[0].connector_count ?? 0} Connectors</span>
            </div>
          </button>
        )}
      </div>

      <div className="owner-bottom-space" />
    </div>
  );
}
