'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Shield,
  Package,
  ShoppingBag,
  AlertTriangle,
  History,
  KeyRound,
  UserCheck,
  Ban,
  Mail,
  Phone,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminStatusPill,
  AdminModal,
  AdminAuditTimeline,
  AdminEmptyState,
} from '@/components/admin/ui';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AdminUser360Page({ params }: Props) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const { showToast } = useToast();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Action Modals state
  const [modalType, setModalType] = useState<
    'reset_password' | 'change_role' | 'update_status' | null
  >(null);
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('buyer');
  const [newStatus, setNewStatus] = useState('active');
  const [actionReason, setActionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    api
      .getUser360(userId)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        if (res?.user?.role) setNewRole(res.user.role);
        if (res?.user?.account_status) setNewStatus(res.user.account_status);
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load user 360 profile', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, showToast, refreshKey]);

  const handleActionSubmit = async () => {
    if (!modalType) return;
    setSubmittingAction(true);
    try {
      let payload: any = { reason: actionReason };
      if (modalType === 'reset_password') {
        payload.password = newPassword || undefined;
      } else if (modalType === 'change_role') {
        payload.role = newRole;
      } else if (modalType === 'update_status') {
        payload.status = newStatus;
      }

      const res = await api.performUserAction(userId, {
        action: modalType,
        payload,
      });

      if (modalType === 'reset_password' && res.temporary_password) {
        alert(`Temporary password generated: ${res.temporary_password}`);
      }

      showToast(res.message || 'Action executed successfully', 'success');
      setModalType(null);
      setActionReason('');
      setNewPassword('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Action execution failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const res = await api.performUserAction(userId, {
        action: 'resend_verification',
      });
      showToast(res.message || 'Verification notice dispatched', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to dispatch verification', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] p-8 flex items-center justify-center">
        <div className="text-sm font-semibold text-gray-500 animate-pulse">
          Loading User 360 profile #{userId}...
        </div>
      </div>
    );
  }

  if (!data || !data.user) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] p-8 space-y-4">
        <Link
          href="/admin/users"
          className="text-xs font-semibold text-[#007a6c] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Users Registry
        </Link>
        <AdminEmptyState
          title="User Not Found"
          description={`User #${userId} does not exist in the database.`}
          actionLabel="Return to Registry"
          onAction={() => window.location.assign('/admin/users')}
        />
      </div>
    );
  }

  const { user, roleProfile, kyc, products, orders, disputes, auditLogs = [] } = data;

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/users"
            className="text-xs font-semibold text-[#007a6c] hover:underline flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Users
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{user.name}</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase bg-gray-900 text-white tracking-wider">
              {user.role}
            </span>
            <AdminStatusPill status={user.account_status} />
            {user.role === 'farmer' && <AdminStatusPill status={user.kyc_status} />}
          </div>
          <p className="text-xs text-gray-500">
            Account #{user.id} • Registered {new Date(user.created_at).toLocaleDateString()} •{' '}
            {user.last_login_at
              ? `Last active ${new Date(user.last_login_at).toLocaleString()}`
              : 'Never logged in'}
          </p>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2">
          {user.role === 'farmer' && (
            <Link
              href={`/admin/kyc/${user.id}`}
              className="px-3 py-1.5 text-xs font-semibold text-[#007a6c] bg-white border border-[#007a6c] hover:bg-teal-50 transition-colors"
            >
              KYC Dossier
            </Link>
          )}
          <button
            onClick={() => setModalType('reset_password')}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-gray-500" />
            Reset Password
          </button>
          <button
            onClick={() => setModalType('change_role')}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5 text-gray-500" />
            Change Role
          </button>
          <button
            onClick={() => setModalType('update_status')}
            className={`px-3 py-1.5 text-xs font-semibold border flex items-center gap-1.5 ${
              user.account_status === 'suspended' || user.account_status === 'banned'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                : 'text-rose-700 bg-rose-50 border-rose-300 hover:bg-rose-100'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            {user.account_status === 'suspended' || user.account_status === 'banned'
              ? 'Reactivate'
              : 'Suspend / Ban'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-300 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Account Status
          </div>
          <div className="text-lg font-bold text-gray-900 mt-1 uppercase">
            {user.account_status}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Verified Email: {user.is_verified ? 'Yes' : 'No'}
          </div>
        </div>

        <div className="bg-white border border-gray-300 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            KYC Tier & Accreditation
          </div>
          <div className="text-lg font-bold text-[#007a6c] mt-1 uppercase">
            {user.kyc_tier || 'tier_0'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Documents: {kyc?.documents?.length || 0}
          </div>
        </div>

        <div className="bg-white border border-gray-300 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {user.role === 'farmer' ? 'Products Listed' : 'Orders Placed'}
          </div>
          <div className="text-lg font-bold text-gray-900 mt-1 tabular-nums">
            {user.role === 'farmer' ? products?.total || 0 : orders?.total || 0}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {user.role === 'farmer'
              ? `${products?.active || 0} active listings`
              : 'Lifetime transaction history'}
          </div>
        </div>

        <div className="bg-white border border-gray-300 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {user.role === 'farmer' ? 'Gross Farm Sales' : 'Total Spent'}
          </div>
          <div className="text-lg font-bold text-gray-900 mt-1 tabular-nums">
            ETB{' '}
            {(user.role === 'farmer'
              ? orders?.total_spent_or_earned
              : orders?.total_spent_or_earned
            )?.toLocaleString() || '0.00'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Disputes Filed: {disputes?.length || 0}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details, Products/Orders, Disputes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Contact Details Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Identity & Contact Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-gray-500 uppercase">Full Name</span>
                <p className="font-bold text-gray-900 text-sm mt-0.5">{user.name}</p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 uppercase">Email Address</span>
                <p className="font-medium text-gray-800 mt-0.5 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {user.email}
                </p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 uppercase">Phone Number</span>
                <p className="font-medium text-gray-800 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {user.phone || 'No phone recorded'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 uppercase">System Permissions</span>
                <p className="font-medium text-gray-800 mt-0.5">
                  {user.admin_role_name || (user.role === 'admin' ? 'Super Admin' : 'Standard User')}
                </p>
              </div>
            </div>

            {roleProfile && user.role === 'farmer' && (
              <div className="pt-3 border-t border-gray-100 text-xs space-y-2">
                <span className="font-semibold text-gray-500 uppercase">Agricultural Profile</span>
                <div className="p-3 bg-gray-50 border border-gray-200 space-y-1">
                  <div className="font-bold text-gray-900">{roleProfile.farm_name || 'Smallholder Farm'}</div>
                  <div className="text-gray-600">{roleProfile.farm_type || 'Mixed Crops'}</div>
                  {roleProfile.bio && <p className="text-gray-700 italic pt-1">{roleProfile.bio}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Role-Specific Activity: Farmer Products */}
          {user.role === 'farmer' && products && (
            <div className="bg-white border border-gray-300 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
                  Farm Produce & Inventory ({products.total})
                </h2>
                <Link
                  href={`/admin/products?farmer=${encodeURIComponent(user.name)}`}
                  className="text-xs font-semibold text-[#007a6c] hover:underline"
                >
                  View in Catalog →
                </Link>
              </div>

              {products.recent.length === 0 ? (
                <div className="text-xs text-gray-500 py-4 text-center">No products listed by this farmer.</div>
              ) : (
                <div className="divide-y divide-gray-100 text-xs">
                  {products.recent.map((p: any) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-gray-500">
                          Stock: {p.stock} units • Listed {new Date(p.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 tabular-nums">ETB {Number(p.price).toFixed(2)}</span>
                        <AdminStatusPill status={p.moderation_status || p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Role-Specific Activity: Orders */}
          {orders && (
            <div className="bg-white border border-gray-300 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
                  Order Activity History ({orders.total})
                </h2>
              </div>

              {orders.recent.length === 0 ? (
                <div className="text-xs text-gray-500 py-4 text-center">No orders recorded for this user.</div>
              ) : (
                <div className="divide-y divide-gray-100 text-xs">
                  {orders.recent.map((o: any) => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900">Order #{o.id}</div>
                        <div className="text-gray-500">{new Date(o.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900 tabular-nums">ETB {Number(o.total_amount).toFixed(2)}</span>
                        <AdminStatusPill status={o.status || 'completed'} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Disputes & Claims */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Disputes & Claims ({disputes?.length || 0})
            </h2>

            {disputes.length === 0 ? (
              <div className="text-xs text-gray-500 py-4 text-center">Clean record — no disputes or return claims on file.</div>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {disputes.map((d: any) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">Claim #{d.id} on Order #{d.order_id}</div>
                      <div className="text-gray-600">{d.reason}</div>
                    </div>
                    <AdminStatusPill status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Audit Timeline */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              User Audit History
            </h2>

            <AdminAuditTimeline
              events={auditLogs.map((log: any) => ({
                id: String(log.id),
                timestamp: log.created_at,
                actor: log.actor_name || 'Admin',
                action: log.action,
                description: log.reason || undefined,
                status: 'info',
              }))}
            />
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <AdminModal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={
          modalType === 'reset_password'
            ? `Reset Password for ${user.name}`
            : modalType === 'change_role'
            ? `Change Platform Role for ${user.name}`
            : `Update Account Status for ${user.name}`
        }
        description="All user administrative mutations require a reason and are permanently audited."
      >
        <div className="space-y-4 text-sm">
          {modalType === 'reset_password' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                New Password (leave blank to auto-generate)
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank for secure auto-generated password"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>
          )}

          {modalType === 'change_role' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Select New Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
              >
                <option value="buyer">Buyer (Wholesaler / Consumer)</option>
                <option value="farmer">Farmer (Producer)</option>
                <option value="delivery_partner">Delivery Partner (Carrier)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}

          {modalType === 'update_status' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Account Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
              >
                <option value="active">Active (Full access)</option>
                <option value="suspended">Suspended (Temporary lockout)</option>
                <option value="banned">Banned (Permanent restriction)</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Administrative Reason *
            </label>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. User requested password reset / Terms violation"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setModalType(null)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleActionSubmit}
              disabled={submittingAction}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#007a6c] hover:bg-[#005f54] disabled:opacity-50"
            >
              {submittingAction ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

