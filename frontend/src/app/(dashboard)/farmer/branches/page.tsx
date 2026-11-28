'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const VERIF_BADGE: Record<string, string> = {
  verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  submitted: 'bg-amber-50 text-amber-800 border-amber-200',
  under_review: 'bg-blue-50 text-blue-800 border-blue-200',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  suspended: 'bg-red-50 text-red-800 border-red-300',
  deactivated: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function FarmerBranchesPage() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'branches' | 'inventory' | 'transfers' | 'financials'>('branches');
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branchInventory, setBranchInventory] = useState<any[]>([]);
  const [farmerProducts, setFarmerProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);

  // Create Branch modal/form state
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: '',
    branch_type: 'warehouse',
    physical_address: '',
    region: 'Oromia',
    city: '',
    latitude: '',
    longitude: '',
    delivery_radius_km: 60,
    max_daily_orders: 50,
    contact_phone: '',
    submit_for_review: true,
  });

  // Add Stock to Branch
  const [stockForm, setStockForm] = useState({
    product_id: '',
    on_hand_quantity: '',
    allocation_policy: 'fifo',
    freshness_grade: 'Grade A',
    harvest_date: '',
    expiry_date: '',
  });

  // Create Transfer
  const [transferForm, setTransferForm] = useState({
    source_branch_id: '',
    destination_branch_id: '',
    product_id: '',
    quantity: '',
    notes: '',
  });

  // Staff assignment
  const [staffForm, setStaffForm] = useState({
    staff_name: '',
    staff_email: '',
    staff_phone: '',
    role: 'branch_manager',
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [bizRes, prodRes, trfRes, finRes] = await Promise.all([
        api.getMyBranches(),
        api.getFarmerProducts().catch(() => ({ products: [] })),
        api.listTransfers().catch(() => ({ transfers: [] })),
        api.getFinancialReconciliation().catch(() => null),
      ]);
      setBusiness(bizRes.business || null);
      const brs = bizRes.branches || [];
      setBranches(brs);
      setFarmerProducts((prodRes as any)?.products || []);
      setTransfers(trfRes.transfers || []);
      setReconciliation(finRes);

      if (brs.length > 0) {
        const targetId = selectedBranchId || brs[0].id || brs[0].branch_id;
        setSelectedBranchId(targetId);
      }
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load multi-branch workspace');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, showError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadSelectedBranchData = useCallback(async (branchId: number) => {
    try {
      const [invRes, detRes] = await Promise.all([
        api.getBranchInventory(branchId),
        api.getBranchDetails(branchId).catch(() => ({ staff: [] })),
      ]);
      setBranchInventory(invRes.items || []);
      setStaffList((detRes as any).staff || []);
    } catch {
      setBranchInventory([]);
    }
  }, []);

  useEffect(() => {
    if (selectedBranchId) loadSelectedBranchData(selectedBranchId);
  }, [selectedBranchId, loadSelectedBranchData]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBranch({
        ...newBranch,
        latitude: newBranch.latitude ? Number(newBranch.latitude) : null,
        longitude: newBranch.longitude ? Number(newBranch.longitude) : null,
      });
      showSuccess('Branch created! Verification workflow initialized.');
      setShowNewBranch(false);
      setNewBranch({
        name: '', branch_type: 'warehouse', physical_address: '', region: 'Oromia',
        city: '', latitude: '', longitude: '', delivery_radius_km: 60, max_daily_orders: 50,
        contact_phone: '', submit_for_review: true,
      });
      loadAll();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to create branch');
    }
  };

  const handleSubmitVerification = async (branchId: number) => {
    try {
      await api.submitBranchVerification(branchId, 'Submitted for admin fulfillment approval');
      showSuccess('Branch submitted for Admin verification review.');
      loadAll();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to submit verification');
    }
  };

  const handleToggleBranchStatus = async (branch: any) => {
    const nextOp = branch.operational_status === 'active' ? 'temporarily_closed' : 'active';
    try {
      const res = await api.updateBranchOperationalStatus(branch.id, nextOp, nextOp === 'active' ? '' : 'Farmer paused branch temporarily');
      showSuccess(`Branch "${branch.name}" marked ${nextOp.replace(/_/g, ' ')}.${res.impacted_exceptions?.length ? ` (${res.impacted_exceptions.length} active package exception(s) flagged)` : ''}`);
      loadAll();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to change branch status');
    }
  };

  const handleSaveBranchStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || !stockForm.product_id) return;
    try {
      await api.upsertBranchInventory(selectedBranchId, {
        product_id: Number(stockForm.product_id),
        on_hand_quantity: Number(stockForm.on_hand_quantity || 0),
        allocation_policy: stockForm.allocation_policy,
        freshness_grade: stockForm.freshness_grade,
        harvest_date: stockForm.harvest_date || null,
        expiry_date: stockForm.expiry_date || null,
        create_batch: true,
      });
      showSuccess('Branch stock & batch updated!');
      setStockForm({ product_id: '', on_hand_quantity: '', allocation_policy: 'fifo', freshness_grade: 'Grade A', harvest_date: '', expiry_date: '' });
      loadSelectedBranchData(selectedBranchId);
      loadAll();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update branch inventory');
    }
  };

  const handleAdjustBucket = async (productId: number, adjustment_type: string, qty = 1) => {
    if (!selectedBranchId) return;
    try {
      await api.adjustBranchInventory(selectedBranchId, { product_id: productId, quantity: qty, adjustment_type });
      showSuccess(`Adjustment (${adjustment_type.replace(/_/g, ' ')}) recorded cleanly.`);
      loadSelectedBranchData(selectedBranchId);
      loadAll();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to adjust stock');
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTransfer({
        source_branch_id: Number(transferForm.source_branch_id),
        destination_branch_id: Number(transferForm.destination_branch_id),
        notes: transferForm.notes,
        items: [{ product_id: Number(transferForm.product_id), quantity: Number(transferForm.quantity) }],
      });
      showSuccess('Inter-branch transfer requested!');
      setTransferForm({ source_branch_id: '', destination_branch_id: '', product_id: '', quantity: '', notes: '' });
      loadAll();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to request transfer');
    }
  };

  const handleTransferAction = async (transferId: number, action: string) => {
    try {
      await api.transitionTransfer(transferId, { action });
      showSuccess(`Transfer ${action.replace(/_/g, ' ')} succeeded.`);
      loadAll();
      if (selectedBranchId) loadSelectedBranchData(selectedBranchId);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Transfer update failed');
    }
  };

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) return;
    try {
      await api.assignBranchStaff(selectedBranchId, staffForm);
      showSuccess('Branch staff assigned with scoped permissions.');
      setStaffForm({ staff_name: '', staff_email: '', staff_phone: '', role: 'branch_manager' });
      loadSelectedBranchData(selectedBranchId);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to assign staff');
    }
  };

  if (loading && branches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-9 h-9 border-4 border-[#286c00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Enterprise Fulfillment Network</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{business?.business_name || 'Farmer Multi-Branch Network'}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Operate multiple farms, warehouses, and collection centers with isolated branch stock, batch freshness, and inter-branch transfers.
          </p>
        </div>
        <button
          onClick={() => setShowNewBranch(!showNewBranch)}
          className="px-4 py-2 bg-[#286c00] hover:bg-[#1f5400] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add_business</span>
          Add New Branch
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {[
          { id: 'branches', label: 'Branches & Staff', icon: 'store' },
          { id: 'inventory', label: 'Branch Inventory & Batches', icon: 'inventory_2' },
          { id: 'transfers', label: 'Stock Transfers', icon: 'swap_horiz' },
          { id: 'financials', label: 'Branch Financial Ledger', icon: 'account_balance' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#286c00] text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Create Branch Drawer */}
      {showNewBranch && (
        <form onSubmit={handleCreateBranch} className="bg-white rounded-xl border border-emerald-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-900">Register New Fulfillment Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <input required placeholder="Branch Name (e.g., Addis Warehouse)" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
            <select value={newBranch.branch_type} onChange={(e) => setNewBranch({ ...newBranch, branch_type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <option value="main_farm">Main Farm</option>
              <option value="agricultural_farm">Agricultural Farm</option>
              <option value="warehouse">Warehouse</option>
              <option value="distribution_center">Distribution Center</option>
              <option value="collection_center">Collection Center</option>
              <option value="retail_branch">Retail Branch</option>
            </select>
            <input required placeholder="Physical Address / Hub" value={newBranch.physical_address} onChange={(e) => setNewBranch({ ...newBranch, physical_address: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
            <input placeholder="Region (e.g., Addis Ababa / Oromia)" value={newBranch.region} onChange={(e) => setNewBranch({ ...newBranch, region: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
            <input placeholder="City / Town" value={newBranch.city} onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
            <input placeholder="Contact Phone" value={newBranch.contact_phone} onChange={(e) => setNewBranch({ ...newBranch, contact_phone: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
            <input type="number" step="0.0001" placeholder="GPS Latitude (e.g., 9.0054)" value={newBranch.latitude} onChange={(e) => setNewBranch({ ...newBranch, latitude: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
            <input type="number" step="0.0001" placeholder="GPS Longitude (e.g., 38.7636)" value={newBranch.longitude} onChange={(e) => setNewBranch({ ...newBranch, longitude: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
            <input type="number" placeholder="Delivery Radius (km)" value={newBranch.delivery_radius_km} onChange={(e) => setNewBranch({ ...newBranch, delivery_radius_km: Number(e.target.value) })} className="px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <input type="checkbox" checked={newBranch.submit_for_review} onChange={(e) => setNewBranch({ ...newBranch, submit_for_review: e.target.checked })} className="accent-[#286c00]" />
              Submit immediately for Admin verification
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNewBranch(false)} className="px-4 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-[#286c00] rounded-lg cursor-pointer">Save Branch</button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 1: BRANCHES & STAFF */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branches.map((b) => {
              const id = b.id || b.branch_id;
              return (
                <div
                  key={id}
                  onClick={() => setSelectedBranchId(id)}
                  className={`bg-white rounded-xl border p-5 space-y-3 cursor-pointer transition-all ${
                    selectedBranchId === id ? 'border-[#286c00] ring-1 ring-[#286c00]' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">{b.name}</h3>
                        {b.is_primary && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">PRIMARY</span>}
                      </div>
                      <p className="text-[11px] font-mono text-gray-500">{b.branch_code} · {b.branch_type?.replace(/_/g, ' ')}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${VERIF_BADGE[b.verification_status] || VERIF_BADGE.draft}`}>
                      {b.verification_status?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-gray-400">location_on</span>
                    {b.physical_address} {b.region ? `(${b.region})` : ''}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Sellable Stock</span>
                      <span className="font-bold text-gray-900 tabular-nums">{Number(b.total_available_stock || 0)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Today Load</span>
                      <span className="font-bold text-gray-900 tabular-nums">{b.today_orders_count || 0} / {b.max_daily_orders || 50}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Status</span>
                      <span className="font-bold text-gray-900 uppercase text-[10px]">{b.operational_status}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {['draft', 'rejected'].includes(b.verification_status) && (
                      <button onClick={() => handleSubmitVerification(id)} className="px-3 py-1.5 text-[11px] font-bold bg-amber-600 text-white rounded-lg cursor-pointer">
                        Submit for Verification
                      </button>
                    )}
                    <button onClick={() => handleToggleBranchStatus(b)} className="px-3 py-1.5 text-[11px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer">
                      {b.operational_status === 'active' ? 'Pause Branch Temporarily' : 'Reopen Branch'}
                    </button>
                    <button onClick={() => { setSelectedBranchId(id); setActiveTab('inventory'); }} className="px-3 py-1.5 text-[11px] font-bold text-[#286c00] border border-emerald-200 bg-emerald-50 rounded-lg cursor-pointer">
                      Manage Stock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Branch Staff Panel */}
          {selectedBranchId && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Branch Staff &amp; Scoped RBAC (Selected Branch #{selectedBranchId})</h3>
              <form onSubmit={handleAssignStaff} className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                <input required placeholder="Staff Name" value={staffForm.staff_name} onChange={(e) => setStaffForm({ ...staffForm, staff_name: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
                <input placeholder="Account Email (links login)" value={staffForm.staff_email} onChange={(e) => setStaffForm({ ...staffForm, staff_email: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
                <input placeholder="Phone" value={staffForm.staff_phone} onChange={(e) => setStaffForm({ ...staffForm, staff_phone: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
                <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="branch_manager">Branch Manager</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="fulfillment_staff">Fulfillment Staff</option>
                  <option value="branch_delivery_staff">Branch Delivery Staff</option>
                </select>
                <button type="submit" className="px-3 py-2 bg-gray-900 text-white font-bold rounded-lg cursor-pointer">Assign Staff</button>
              </form>
              {staffList.length > 0 && (
                <div className="divide-y divide-gray-100 text-xs">
                  {staffList.map((st) => (
                    <div key={st.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900">{st.staff_name}</span>{' '}
                        <span className="text-gray-500">({st.role.replace(/_/g, ' ')}) · {st.staff_email || st.staff_phone || 'No account email'}</span>
                      </div>
                      <button
                        onClick={async () => {
                          await api.removeBranchStaff(selectedBranchId, st.id);
                          loadSelectedBranchData(selectedBranchId);
                        }}
                        className="text-red-600 font-bold hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BRANCH INVENTORY & BATCHES */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-900">Branch Stock Ledger</h2>
              <select
                value={selectedBranchId || ''}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.verification_status})</option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSaveBranchStock} className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs bg-gray-50 p-3 rounded-lg border border-gray-200">
              <select required value={stockForm.product_id} onChange={(e) => setStockForm({ ...stockForm, product_id: e.target.value })} className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="">Select Product...</option>
                {farmerProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.unit || 'kg'})</option>
                ))}
              </select>
              <input required type="number" min="0" placeholder="On-Hand Qty" value={stockForm.on_hand_quantity} onChange={(e) => setStockForm({ ...stockForm, on_hand_quantity: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white" />
              <select value={stockForm.allocation_policy} onChange={(e) => setStockForm({ ...stockForm, allocation_policy: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="fifo">FIFO (First In First Out)</option>
                <option value="fefo">FEFO (First Expiring Out)</option>
                <option value="none">No Batch Rotation</option>
              </select>
              <input type="date" title="Expiry Date" value={stockForm.expiry_date} onChange={(e) => setStockForm({ ...stockForm, expiry_date: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white" />
              <button type="submit" className="px-3 py-2 bg-[#286c00] text-white font-bold rounded-lg cursor-pointer">Set Stock + Lot</button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">On Hand</th>
                    <th className="p-3">Reserved</th>
                    <th className="p-3">Committed</th>
                    <th className="p-3">Damaged / Quarantine</th>
                    <th className="p-3">Available</th>
                    <th className="p-3">Policy / Grade</th>
                    <th className="p-3 text-right">Adjustments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {branchInventory.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 font-bold text-gray-900">{item.product_name} <span className="text-gray-400 font-normal">({item.unit})</span></td>
                      <td className="p-3 tabular-nums">{item.on_hand_quantity}</td>
                      <td className="p-3 tabular-nums text-amber-700">{item.reserved_quantity}</td>
                      <td className="p-3 tabular-nums text-blue-700">{item.committed_quantity}</td>
                      <td className="p-3 tabular-nums text-red-700">{item.damaged_quantity} dmg / {item.returned_quantity} ret</td>
                      <td className="p-3 font-bold text-emerald-700 tabular-nums">{item.available_quantity}</td>
                      <td className="p-3 uppercase text-[10px] font-bold">{item.allocation_policy} · {item.freshness_grade || 'Std'}</td>
                      <td className="p-3 text-right space-x-1">
                        <button onClick={() => handleAdjustBucket(item.product_id, 'mark_damaged', 1)} className="px-2 py-1 border border-red-200 text-red-700 rounded text-[10px] font-bold cursor-pointer">-1 Damaged</button>
                        {Number(item.returned_quantity) > 0 && (
                          <button onClick={() => handleAdjustBucket(item.product_id, 'approve_return_restock', 1)} className="px-2 py-1 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold cursor-pointer">Restock 1 Return</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {branchInventory.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-gray-400">No inventory assigned to this branch yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONTROLLED INTER-BRANCH TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateTransfer} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Request Controlled Inter-Branch Stock Transfer</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
              <select required value={transferForm.source_branch_id} onChange={(e) => setTransferForm({ ...transferForm, source_branch_id: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="">Source Branch...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select required value={transferForm.destination_branch_id} onChange={(e) => setTransferForm({ ...transferForm, destination_branch_id: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="">Destination Branch...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select required value={transferForm.product_id} onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="">Product...</option>
                {farmerProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input required type="number" min="1" placeholder="Quantity" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
              <button type="submit" className="px-3 py-2 bg-[#286c00] text-white font-bold rounded-lg cursor-pointer">Request Transfer</button>
            </div>
          </form>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {transfers.map((tr) => (
              <div key={tr.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-mono font-bold text-gray-900">{tr.transfer_number}</span>{' '}
                  <span className="px-2 py-0.5 rounded bg-gray-100 font-bold uppercase text-[10px]">{tr.status?.replace(/_/g, ' ')}</span>
                  <p className="text-gray-600 mt-1">
                    {tr.source_branch_name} → {tr.destination_branch_name} · Items:{' '}
                    {(tr.items || []).map((i: any) => `${i.product_name} × ${i.requested_quantity}`).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {tr.status === 'requested' && (
                    <button onClick={() => handleTransferAction(tr.id, 'approve')} className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg cursor-pointer">Approve &amp; Reserve</button>
                  )}
                  {['approved', 'stock_reserved'].includes(tr.status) && (
                    <button onClick={() => handleTransferAction(tr.id, 'dispatch')} className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg cursor-pointer">Dispatch</button>
                  )}
                  {['in_transit', 'delayed'].includes(tr.status) && (
                    <button onClick={() => handleTransferAction(tr.id, 'receive_and_verify')} className="px-3 py-1.5 bg-emerald-700 text-white font-bold rounded-lg cursor-pointer">Receive &amp; Verify</button>
                  )}
                </div>
              </div>
            ))}
            {transfers.length === 0 && <div className="p-6 text-center text-xs text-gray-400">No inter-branch transfers yet.</div>}
          </div>
        </div>
      )}

      {/* TAB 4: BRANCH FINANCIAL LEDGER */}
      {activeTab === 'financials' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-900">Branch-Attributed Revenue &amp; Escrow Reconciliation</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Packages</th>
                  <th className="p-3">Produce Sales</th>
                  <th className="p-3">Buyer Delivery Fees</th>
                  <th className="p-3">Marketplace Fees</th>
                  <th className="p-3">Net Farmer Payouts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums">
                {(reconciliation?.branch_financial_summary || []).map((row: any) => (
                  <tr key={row.branch_id}>
                    <td className="p-3 font-bold text-gray-900">{row.branch_name}</td>
                    <td className="p-3">{row.suborders_count}</td>
                    <td className="p-3 font-semibold">{Number(row.gross_produce_sales || 0).toFixed(2)} ETB</td>
                    <td className="p-3">{Number(row.buyer_delivery_charges || 0).toFixed(2)} ETB</td>
                    <td className="p-3 text-gray-600">{Number(row.marketplace_commissions || 0).toFixed(2)} ETB</td>
                    <td className="p-3 font-bold text-emerald-700">{Number(row.net_farmer_payouts || 0).toFixed(2)} ETB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
