'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminStatusPill,
  AdminModal,
  AdminTableColumn,
} from '@/components/admin/ui';
import { BaseCard } from '@/components/admin/cards';

interface AdminMember {
  id: string | number;
  name: string;
  email: string;
  role: string;
  account_status: string;
  admin_role_id: number | null;
  admin_role_name: string | null;
  admin_role_description: string | null;
  total_actions_logged: number;
  last_login_at: string | null;
  created_at: string;
}

interface AdminRoleDef {
  id: number;
  name: string;
  description: string;
  permissions: Array<{ id: number; code: string; name: string; category: string }>;
}

export default function AdminTeamPage() {
  const [team, setTeam] = useState<AdminMember[]>([]);
  const [roles, setRoles] = useState<AdminRoleDef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<AdminMember | null>(null);
  const [newRoleId, setNewRoleId] = useState<number>(1);
  const [updating, setUpdating] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    Promise.all([api.getAdminTeam(), api.getAdminRoles()])
      .then(([teamRes, rolesRes]) => {
        if (!isMounted) return;
        if (Array.isArray(teamRes?.team)) {
          setTeam(teamRes.team);
        }
        if (Array.isArray(rolesRes?.roles)) {
          setRoles(rolesRes.roles);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load admin team:', err);
        setNotice({ message: 'Failed to load administrative team records.', type: 'error' });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const filteredTeam = team.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    (m.admin_role_name && m.admin_role_name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenRoleModal = (member: AdminMember) => {
    setSelectedMember(member);
    setNewRoleId(member.admin_role_id || 1);
  };

  const handleSaveRole = async () => {
    if (!selectedMember) return;
    try {
      setUpdating(true);
      await api.updateAdminRole(selectedMember.id, newRoleId);
      setNotice({
        message: `Administrative role updated for ${selectedMember.name}. Permission changes take effect immediately.`,
        type: 'success',
      });
      setTimeout(() => setNotice(null), 4000);
      setSelectedMember(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      let msg = 'Failed to update administrative role.';
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { message?: string } } }).response;
        if (resp?.data?.message) msg = resp.data.message;
      }
      setNotice({
        message: msg,
        type: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  const columns: AdminTableColumn<AdminMember>[] = [
    {
      header: 'Admin Name & Email',
      render: (m) => (
        <div>
          <p className="font-bold text-gray-900">{m.name}</p>
          <p className="text-gray-500 font-mono text-[11px]">{m.email}</p>
        </div>
      ),
    },
    {
      header: 'Assigned Role',
      render: (m) => (
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#1f5400] border border-emerald-200 uppercase tabular-nums">
            <i className="fa-solid fa-shield-halved text-[10px]" />
            <span>{(m.admin_role_name || 'super_admin').replace(/_/g, ' ')}</span>
          </span>
          {m.admin_role_description && (
            <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-xs">
              {m.admin_role_description}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      className: 'w-32',
      render: (m) => (
        <AdminStatusPill
          status={m.account_status || 'active'}
          variant={m.account_status === 'active' ? 'active' : 'suspended'}
        />
      ),
    },
    {
      header: 'Logged Actions',
      className: 'tabular-nums w-32',
      render: (m) => (
        <span className="font-bold text-gray-800">
          {m.total_actions_logged.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Last Session Active',
      className: 'tabular-nums w-44',
      render: (m) => (
        <span className="text-gray-600 font-mono">
          {m.last_login_at
            ? new Date(m.last_login_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Active Today'}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right w-36',
      render: (m) => (
        <button
          type="button"
          onClick={() => handleOpenRoleModal(m)}
          className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors shadow-2xs"
        >
          Assign Role
        </button>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Admin Team & Roles"
        description="Role-based access control (RBAC), security clearances, and administrator privileges"
        icon="fa-user-shield"
        badge={team.length}
        badgeLabel="Admins"
        actions={
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            <span>Dashboard</span>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {notice && (
          <div
            className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <i className={`fa-solid ${notice.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-red-600'} text-sm`} />
            <span>{notice.message}</span>
          </div>
        )}

        <AdminToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search admin name, email, or role..."
          onRefresh={() => {
            setLoading(true);
            setRefreshTrigger((prev) => prev + 1);
          }}
          isRefreshing={loading}
        />

        <AdminTable
          columns={columns}
          data={filteredTeam}
          loading={loading}
          emptyTitle="No administrator accounts found"
          emptyDescription="Administrative accounts are provisioned under enterprise authorization."
          emptyIcon="fa-user-shield"
          rowKey={(m) => m.id}
        />

        {/* Available Roles & Permission Matrix */}
        <BaseCard
          title="Role Permissions Matrix"
          subtitle="Granular functional permissions mapped to each operational role"
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCF9F8] border-b border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="py-3 px-4 w-44">Role Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Permitted Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {roles.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900 uppercase">
                      {r.name.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {r.description}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xl">
                        {r.permissions.map((p) => (
                          <span
                            key={p.id}
                            className="text-[10px] font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-200 px-2 py-0.5 rounded"
                          >
                            {p.code}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>

      {/* Role Assignment Modal */}
      {selectedMember && (
        <AdminModal
          isOpen={true}
          onClose={() => setSelectedMember(null)}
          title={`Assign Role: ${selectedMember.name}`}
          subtitle={`Current: ${(selectedMember.admin_role_name || 'super_admin').replace(/_/g, ' ')}`}
          icon="fa-user-shield"
          maxWidth="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={updating}
                className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {updating && <i className="fa-solid fa-spinner animate-spin text-xs" />}
                <span>Save Role Assignment</span>
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                Select Administrative Role
              </label>
              <select
                value={newRoleId}
                onChange={(e) => setNewRoleId(parseInt(e.target.value, 10))}
                className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name.toUpperCase().replace(/_/g, ' ')} — {r.description}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-gray-500">
              Role changes take effect immediately across all sessions and are logged to the audit stream.
            </p>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
