import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerService } from '../../../services/api';
import LocationPicker from '../../../components/LocationPicker';
import {
  ArrowLeft, Building2, MapPin, AlertTriangle, Loader2, CheckCircle2, Zap, IndianRupee,
} from 'lucide-react';

export default function CreateStationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    price_per_kwh: '',
    power: '',
    operator_name: '',
    contact_number: '',
    is_fast_charging: false,
  });
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLocWarning, setShowLocWarning] = useState(false);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const locationCaptured = lat != null && lng != null;

  const onPick = (la: number, lo: number) => {
    setLat(la);
    setLng(lo);
    setShowLocWarning(false);
  };

  const submit = async () => {
    setError('');
    if (!form.name.trim()) return setError('Station name is required');
    if (!form.address.trim()) return setError('Station address is required');

    // Location is mandatory — show a clear warning if not captured.
    if (!locationCaptured) {
      setShowLocWarning(true);
      setError('Please capture the station location on the map below');
      return;
    }

    setLoading(true);
    try {
      const station = await ownerService.createStation({
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        postal_code: form.postal_code.trim() || undefined,
        latitude: lat!,
        longitude: lng!,
        price_per_kwh: form.price_per_kwh ? Number(form.price_per_kwh) : 0,
        is_fast_charging: form.is_fast_charging,
        power: form.power.trim() || undefined,
        operator_name: form.operator_name.trim() || undefined,
        contact_number: form.contact_number.trim() || undefined,
      });
      // straight into infrastructure setup for the new station
      navigate(`/owner/stations/${station.station_id}`, { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to create station');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <button className="owner-back" onClick={() => navigate('/owner')}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="owner-h1">New Station</h1>
          <p className="owner-sub">List a new charging location</p>
        </div>
      </div>

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

      <div className="owner-card">
        <div className="owner-card-title"><Building2 size={16} /> Station details</div>

        <div className="owner-field">
          <label>Station name *</label>
          <input className="owner-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. DJT PowerHub Main Road" />
        </div>

        <div className="owner-field">
          <label>Address *</label>
          <textarea className="owner-input owner-textarea" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Full street address" rows={2} />
        </div>

        <div className="owner-grid-2">
          <div className="owner-field">
            <label>City</label>
            <input className="owner-input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
          </div>
          <div className="owner-field">
            <label>State</label>
            <input className="owner-input" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State" />
          </div>
        </div>

        <div className="owner-grid-2">
          <div className="owner-field">
            <label>Pincode</label>
            <input className="owner-input" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value.replace(/\D/g, ''))} placeholder="Postal code" maxLength={10} />
          </div>
          <div className="owner-field">
            <label><IndianRupee size={12} /> Price / kWh</label>
            <input className="owner-input" type="number" value={form.price_per_kwh} onChange={(e) => set('price_per_kwh', e.target.value)} placeholder="10.00" />
          </div>
        </div>

        <div className="owner-grid-2">
          <div className="owner-field">
            <label>Peak power</label>
            <input className="owner-input" value={form.power} onChange={(e) => set('power', e.target.value)} placeholder="e.g. 150kW" />
          </div>
          <div className="owner-field">
            <label>Contact number</label>
            <input className="owner-input" value={form.contact_number} onChange={(e) => set('contact_number', e.target.value.replace(/\D/g, ''))} placeholder="10-digit" maxLength={10} />
          </div>
        </div>

        <label className="owner-switch">
          <input type="checkbox" checked={form.is_fast_charging} onChange={(e) => set('is_fast_charging', e.target.checked)} />
          <span className="owner-switch-track"><span className="owner-switch-thumb" /></span>
          <span className="owner-switch-label"><Zap size={14} /> Fast charging available</span>
        </label>
      </div>

      {/* Location capture */}
      <div className="owner-card">
        <div className="owner-card-title">
          <MapPin size={16} /> Station location *
          {locationCaptured ? (
            <span className="owner-loc-ok"><CheckCircle2 size={14} /> Captured</span>
          ) : (
            <span className="owner-loc-pending">Not set</span>
          )}
        </div>

        {showLocWarning && !locationCaptured && (
          <div className="owner-alert owner-alert-warning">
            <AlertTriangle size={16} />
            <span>You must capture the station's exact location before saving. Tap the map or use your current location.</span>
          </div>
        )}

        <LocationPicker latitude={lat} longitude={lng} onChange={onPick} />

        {locationCaptured && (
          <div className="owner-coords">
            <span><strong>Lat:</strong> {lat!.toFixed(6)}</span>
            <span><strong>Lng:</strong> {lng!.toFixed(6)}</span>
          </div>
        )}
      </div>

      <button className="owner-btn owner-btn-primary owner-btn-block" onClick={submit} disabled={loading}>
        {loading ? (<><Loader2 className="owner-spin" size={18} /> Creating…</>) : (<><CheckCircle2 size={18} /> Create station &amp; add machines</>)}
      </button>
      <div className="owner-bottom-space" />
    </div>
  );
}
