'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface SavedAddress {
  id: number;
  label: string;
  recipient_name: string;
  phone: string;
  region: string;
  city: string;
  subcity: string;
  woreda?: string;
  kebele?: string;
  street_address: string;
  landmark?: string;
  gps_lat?: number;
  gps_lng?: number;
  is_default: boolean;
  zone_name?: string;
  zone_code?: string;
  created_at: string;
}

const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Oromia',
  'Amhara',
  'Tigray',
  'SNNPR',
  'Sidama',
  'Afar',
  'Somali',
  'Benishangul-Gumuz',
  'Gambela',
  'Harari',
  'Dire Dawa',
];

const ADDIS_SUBCITIES = [
  'Addis Ketema', 'Akaki Kality', 'Arada', 'Bole', 'Gullele',
  'Kirkos', 'Kolfe Keranio', 'Lideta', 'Nifas Silk-Lafto', 'Yeka',
  'Lemi Kura', 'Cherkos',
];

const emptyForm = {
  label: '',
  recipient_name: '',
  phone: '',
  region: 'Addis Ababa',
  city: 'Addis Ababa',
  subcity: '',
  woreda: '',
  kebele: '',
  street_address: '',
  landmark: '',
  gps_lat: '',
  gps_lng: '',
  is_default: false,
};

export default function BuyerAddressesPage() {
  const { showSuccess, showError } = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [detectedZone, setDetectedZone] = useState<{ zone_name?: string; zone_code?: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAddresses();
      setAddresses(res.addresses || []);
    } catch {
      showError('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleGpsAutoDetect = () => {
    if (!navigator.geolocation) {
      showError('GPS not supported by your browser');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          gps_lat: pos.coords.latitude.toFixed(6),
          gps_lng: pos.coords.longitude.toFixed(6),
        }));
        setLocationLoading(false);
      },
      () => {
        showError('Could not detect location. Please enter coordinates manually.');
        setLocationLoading(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label || !form.recipient_name || !form.phone || !form.region || !form.street_address) {
      showError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setDetectedZone(null);
    try {
      const payload: Record<string, unknown> = {
        label: form.label,
        recipient_name: form.recipient_name,
        phone: form.phone,
        region: form.region,
        city: form.city || form.region,
        subcity: form.subcity,
        woreda: form.woreda,
        kebele: form.kebele,
        street_address: form.street_address,
        landmark: form.landmark,
        is_default: form.is_default,
      };
      if (form.gps_lat && form.gps_lng) {
        payload.gps_lat = parseFloat(form.gps_lat);
        payload.gps_lng = parseFloat(form.gps_lng);
      }
      const res = await api.createAddress(payload);
      if (res.detected_zone) setDetectedZone(res.detected_zone);
      showSuccess('Address saved successfully');
      setShowForm(false);
      setForm({ ...emptyForm });
      await fetchAddresses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save address';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this address?')) return;
    setDeletingId(id);
    try {
      await api.deleteAddress(id);
      showSuccess('Address removed');
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      showError('Failed to delete address');
    } finally {
      setDeletingId(null);
    }
  };

  const regionSubcities = form.region === 'Addis Ababa' ? ADDIS_SUBCITIES : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="material-icons text-green-600">location_on</span>
              My Delivery Addresses
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your Ethiopian delivery addresses. Zone pricing is auto-detected.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setDetectedZone(null); setForm({ ...emptyForm }); }}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
          >
            <span className="material-icons text-sm">add</span>
            Add Address
          </button>
        </div>

        {/* Zone detected banner */}
        {detectedZone?.zone_name && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-800 text-sm">
            <span className="material-icons text-sm text-blue-500">info</span>
            Address saved and assigned to delivery zone: <strong>{detectedZone.zone_name}</strong>
            {detectedZone.zone_code && <span className="text-blue-500 ml-1">({detectedZone.zone_code})</span>}
          </div>
        )}

        {/* Add Address Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="material-icons text-green-600 text-base">add_location_alt</span>
                New Delivery Address
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Label & default */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Home, Work, Parents"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="text-sm text-gray-700">Set as default address</span>
                  </label>
                </div>
              </div>

              {/* Recipient */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Recipient Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Full name of recipient"
                    value={form.recipient_name}
                    onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+251 9XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              {/* Region & City */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value, city: e.target.value, subcity: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {ETHIOPIAN_REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="City name"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Subcity / Woreda */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subcity / Zone</label>
                  {regionSubcities.length > 0 ? (
                    <select
                      value={form.subcity}
                      onChange={(e) => setForm((f) => ({ ...f, subcity: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select subcity</option>
                      {regionSubcities.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Subcity or zone"
                      value={form.subcity}
                      onChange={(e) => setForm((f) => ({ ...f, subcity: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Woreda</label>
                  <input
                    type="text"
                    placeholder="Woreda number or name"
                    value={form.woreda}
                    onChange={(e) => setForm((f) => ({ ...f, woreda: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Kebele & Street */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kebele</label>
                  <input
                    type="text"
                    placeholder="Kebele number"
                    value={form.kebele}
                    onChange={(e) => setForm((f) => ({ ...f, kebele: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Street / Building <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Street or building number"
                    value={form.street_address}
                    onChange={(e) => setForm((f) => ({ ...f, street_address: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              {/* Landmark */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nearby Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Near Bole Medhanealem Church, Opposite CBE"
                  value={form.landmark}
                  onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* GPS Coordinates */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">GPS Coordinates (optional — improves delivery accuracy)</label>
                  <button
                    type="button"
                    onClick={handleGpsAutoDetect}
                    disabled={locationLoading}
                    className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 disabled:opacity-60"
                  >
                    <span className="material-icons text-xs">my_location</span>
                    {locationLoading ? 'Detecting…' : 'Auto-detect'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    placeholder="Latitude (e.g. 9.0320)"
                    value={form.gps_lat}
                    onChange={(e) => setForm((f) => ({ ...f, gps_lat: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Longitude (e.g. 38.7469)"
                    value={form.gps_lng}
                    onChange={(e) => setForm((f) => ({ ...f, gps_lng: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="material-icons animate-spin text-sm">refresh</span>
                      Saving…
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-sm">save</span>
                      Save Address
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Address List */}
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <span className="material-icons animate-spin text-green-500 text-3xl">refresh</span>
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
            <span className="material-icons text-gray-300 text-5xl block mb-3">location_off</span>
            <p className="text-gray-500 font-medium">No saved addresses yet</p>
            <p className="text-gray-400 text-sm mt-1">Add an address to speed up checkout and get accurate delivery fee estimates.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
            >
              <span className="material-icons text-sm">add</span>
              Add Your First Address
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition ${
                  addr.is_default ? 'border-green-300' : 'border-gray-200'
                }`}
              >
                <div className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 p-2 rounded-lg ${addr.is_default ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <span className={`material-icons text-sm ${addr.is_default ? 'text-green-600' : 'text-gray-500'}`}>
                        {addr.label?.toLowerCase().includes('work') ? 'work' :
                         addr.label?.toLowerCase().includes('home') ? 'home' : 'location_on'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{addr.label}</span>
                        {addr.is_default && (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            Default
                          </span>
                        )}
                        {addr.zone_name && (
                          <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                            {addr.zone_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        {addr.recipient_name} · {addr.phone}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {[addr.street_address, addr.kebele && `Kebele ${addr.kebele}`, addr.woreda && `Woreda ${addr.woreda}`, addr.subcity, addr.city, addr.region]
                          .filter(Boolean).join(', ')}
                      </p>
                      {addr.landmark && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <span className="material-icons text-xs">place</span>
                          Near: {addr.landmark}
                        </p>
                      )}
                      {addr.gps_lat && addr.gps_lng && (
                        <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                          <span className="material-icons text-xs">gps_fixed</span>
                          GPS: {Number(addr.gps_lat).toFixed(4)}, {Number(addr.gps_lng).toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDelete(addr.id)}
                      disabled={deletingId === addr.id}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                      title="Delete address"
                    >
                      {deletingId === addr.id ? (
                        <span className="material-icons animate-spin text-sm">refresh</span>
                      ) : (
                        <span className="material-icons text-sm">delete_outline</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Note */}
        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
          <span className="material-icons text-amber-500 text-sm mt-0.5">info</span>
          <span>
            Addresses are used to calculate accurate delivery fees and assign you to the nearest GreenHarvest delivery zone.
            Adding GPS coordinates significantly improves delivery fee accuracy.
          </span>
        </div>
      </div>
    </div>
  );
}
