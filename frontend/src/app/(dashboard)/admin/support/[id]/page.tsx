'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Lock,
  Send,
  UserCheck,
  Truck,
  Package,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminModal,
} from '@/components/admin/ui';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminTicketDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;
  const { showToast } = useToast();

  const [dossier, setDossier] = useState<{ ticket: any; messages: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // Message Form State
  const [replyMessage, setReplyMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status and Escalate Modal State
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [escalateModal, setEscalateModal] = useState<{
    isOpen: boolean;
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    reason: '',
    isSubmitting: false,
  });

  const fetchDossier = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminTicketDossier(ticketId);
      if (res) {
        setDossier(res);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch ticket details', 'error');
    } finally {
      setLoading(false);
    }
  }, [ticketId, showToast]);

  useEffect(() => {
    fetchDossier();
  }, [fetchDossier]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setIsSubmitting(true);
    try {
      await api.addAdminTicketMessage(ticketId, {
        message: replyMessage.trim(),
        is_internal: isInternal,
      });

      showToast(
        isInternal ? 'Internal team note added' : 'Reply delivered to customer',
        'success'
      );
      setReplyMessage('');
      fetchDossier();
    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdateLoading(true);
    try {
      await api.updateAdminTicket(ticketId, { status: newStatus });
      showToast(`Ticket status updated to ${newStatus.replace(/_/g, ' ')}`, 'success');
      fetchDossier();
    } catch (err: any) {
      showToast(err.message || 'Failed to update ticket status', 'error');
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleEscalateSubmit = async () => {
    setEscalateModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.escalateAdminTicket(ticketId, escalateModal.reason.trim());
      showToast('Ticket escalated to URGENT priority', 'success');
      setEscalateModal({ isOpen: false, reason: '', isSubmitting: false });
      fetchDossier();
    } catch (err: any) {
      showToast(err.message || 'Failed to escalate ticket', 'error');
      setEscalateModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FCF9F8]">
        <div className="p-8 text-center text-xs font-semibold text-gray-500 flex items-center gap-2">
          <i className="fa-solid fa-spinner animate-spin text-[#007a6c] text-sm" />
          <span>Loading support ticket thread...</span>
        </div>
      </div>
    );
  }

  if (!dossier || !dossier.ticket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#FCF9F8] p-8">
        <AlertTriangle className="w-10 h-10 text-amber-600 mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Ticket Not Found</h2>
        <p className="text-xs text-gray-600 mt-1 mb-4">
          The requested support ticket does not exist or has been archived.
        </p>
        <Link
          href="/admin/support"
          className="px-4 py-2 bg-[#1f5400] text-white text-xs font-bold rounded-none"
        >
          Return to Support Queue
        </Link>
      </div>
    );
  }

  const { ticket, messages } = dossier;
  const isUrgent = ticket.priority === 'urgent';
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Top Header */}
      <AdminPageHeader
        title={`${ticket.ticket_number}: ${ticket.subject}`}
        subtitle={`Submitted by ${ticket.customer_name || 'User'} (${ticket.customer_role || 'Customer'}) on ${
          ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'
        }`}
        icon="fa-headset"
        badge={ticket.status.replace(/_/g, ' ')}
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Support Queue', href: '/admin/support' },
          { label: ticket.ticket_number },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Status Dropdown */}
            <select
              value={ticket.status}
              disabled={statusUpdateLoading}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 font-bold focus:outline-none focus:border-[#1f5400] text-gray-800"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_on_customer">Waiting on Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            {/* Escalate button */}
            {!isUrgent && !isClosed && (
              <button
                onClick={() => setEscalateModal((prev) => ({ ...prev, isOpen: true }))}
                className="px-3.5 py-1.5 bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 text-xs font-bold rounded-none transition-colors"
              >
                Escalate Urgent
              </button>
            )}

            <Link
              href="/admin/support"
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-gray-500" />
              <span>Back to Queue</span>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Conversation Stream */}
          <div className="lg:col-span-2 space-y-6">
            {/* Thread Container */}
            <div className="bg-white border border-gray-300 rounded-none">
              <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                    Inquiry History & Correspondence Thread
                  </span>
                  <span className="text-[11px] font-mono text-gray-500">
                    ({messages.length} entries)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-bold uppercase ${
                      ticket.priority === 'urgent'
                        ? 'bg-red-50 text-red-800 border border-red-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    Priority: {ticket.priority}
                  </span>
                </div>
              </div>

              {/* Messages list */}
              <div className="p-6 space-y-5">
                {messages.map((m: any) => {
                  const isOpNote = Boolean(m.is_internal);
                  const isStaff = m.sender_type === 'admin';

                  return (
                    <div
                      key={m.id}
                      className={`p-4 border text-xs ${
                        isOpNote
                          ? 'bg-amber-50/60 border-amber-300'
                          : isStaff
                          ? 'bg-[#FCF9F8] border-gray-300'
                          : 'bg-white border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">
                            {m.sender_name || (isStaff ? 'Operations Staff' : 'Customer')}
                          </span>
                          {isOpNote ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2">
                              <Lock className="w-2.5 h-2.5" />
                              Internal Operator Note
                            </span>
                          ) : isStaff ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1f5400] bg-emerald-100 border border-emerald-200 px-1.5 py-0.2">
                              GreenHarvest Support
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100 border border-blue-200 px-1.5 py-0.2">
                              Customer
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {m.created_at
                            ? new Date(m.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {m.message}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Reply / Note Composer */}
              <div className="p-5 border-t border-gray-300 bg-[#FCF9F8]">
                <form onSubmit={handleSendMessage} className="space-y-3">
                  {/* Mode switcher tabs */}
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <button
                      type="button"
                      onClick={() => setIsInternal(false)}
                      className={`text-xs font-bold px-3 py-1 transition-colors ${
                        !isInternal
                          ? 'bg-[#1f5400] text-white'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Reply to Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternal(true)}
                      className={`text-xs font-bold px-3 py-1 flex items-center gap-1 transition-colors ${
                        isInternal
                          ? 'bg-amber-600 text-white'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>Internal Team Note</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={4}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder={
                        isInternal
                          ? 'Record technical investigation notes, warehouse contact logs, or internal assessment (visible ONLY to GreenHarvest admin staff)...'
                          : 'Type your official response to the customer or producer. This will be transmitted via in-app notification...'
                      }
                      className="w-full text-xs p-3 border border-gray-300 rounded-none bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-gray-500">
                      {isInternal
                        ? '🔒 Internal notes are shielded from customers and preserved in the audit log.'
                        : '✉️ The customer will receive an immediate in-app notice and email notification.'}
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting || !replyMessage.trim()}
                      className={`px-4 py-2 text-xs font-bold rounded-none text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                        isInternal ? 'bg-amber-700 hover:bg-amber-800' : 'bg-[#1f5400] hover:bg-[#173e00]'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                          <span>Delivering...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{isInternal ? 'Add Internal Note' : 'Send Customer Reply'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column: Customer & Context Cards */}
          <div className="space-y-6">
            {/* Customer 360 Summary */}
            <div className="bg-white border border-gray-300 rounded-none p-5 space-y-4">
              <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider block border-b border-gray-100 pb-2">
                Customer Dossier
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Name:</span>
                  <span className="font-bold text-gray-900">{ticket.customer_name || 'Anonymous'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Role:</span>
                  <span className="font-mono text-gray-700 uppercase font-bold">{ticket.customer_role || 'User'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Phone:</span>
                  <span className="font-mono text-gray-800">{ticket.customer_phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Email:</span>
                  <span className="text-gray-800">{ticket.customer_email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">KYC Status:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2">
                    {ticket.customer_kyc_status || 'Verified'}
                  </span>
                </div>
                {ticket.user_id && (
                  <div className="pt-2">
                    <Link
                      href={`/admin/users/${ticket.user_id}`}
                      className="text-[#1f5400] font-bold text-xs hover:underline flex items-center gap-1"
                    >
                      <span>View Full User Profile</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Logistics & Commerce Operations */}
            <div className="bg-white border border-gray-300 rounded-none p-5 space-y-4">
              <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider block border-b border-gray-100 pb-2">
                Linked Operational Assets
              </span>

              <div className="space-y-3 text-xs">
                {ticket.order_id ? (
                  <div className="p-3 bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-gray-500" />
                        <span>Order #{ticket.order_number || ticket.order_id}</span>
                      </span>
                      <span className="font-mono font-bold text-[#1f5400]">
                        ETB {Number(ticket.order_total || 0).toLocaleString()}
                      </span>
                    </div>
                    <Link
                      href={`/admin/orders/${ticket.order_id}`}
                      className="text-[#1f5400] text-[11px] font-bold hover:underline flex items-center gap-1 mt-1"
                    >
                      <span>Inspect Commerce Dossier</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs italic">No commerce order attached.</p>
                )}

                {ticket.shipment_id ? (
                  <div className="p-3 bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-gray-500" />
                        <span>Shipment {ticket.shipment_id}</span>
                      </span>
                      <span className="font-mono text-gray-600 text-[11px]">
                        {ticket.shipment_plate || 'In Transit'}
                      </span>
                    </div>
                    <Link
                      href={`/admin/deliveries?search=${encodeURIComponent(ticket.shipment_id)}`}
                      className="text-[#1f5400] text-[11px] font-bold hover:underline flex items-center gap-1 mt-1"
                    >
                      <span>View Live Fleet Telemetry</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs italic">No freight shipment attached.</p>
                )}
              </div>
            </div>

            {/* Assignment & Triage Ownership */}
            <div className="bg-white border border-gray-300 rounded-none p-5 space-y-3">
              <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider block border-b border-gray-100 pb-2">
                Operational Assignee
              </span>

              <div className="text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#007a6c]" />
                  <div>
                    <div className="font-bold text-gray-900">
                      {ticket.assignee_name || 'Unassigned Staff'}
                    </div>
                    <div className="text-gray-500 text-[11px]">
                      {ticket.assignee_email || 'Awaiting agent claim'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Escalate Modal */}
      <AdminModal
        isOpen={escalateModal.isOpen}
        onClose={() => setEscalateModal((prev) => ({ ...prev, isOpen: false }))}
        title="Escalate Ticket to URGENT Priority"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => setEscalateModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={escalateModal.isSubmitting}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Cancel
            </button>
            <button
              onClick={handleEscalateSubmit}
              disabled={escalateModal.isSubmitting}
              className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-none transition-colors disabled:opacity-50"
            >
              {escalateModal.isSubmitting ? 'Escalating...' : 'Confirm Escalation'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-700">
            Escalating this ticket will flag it as <strong>URGENT</strong> across the operational dashboard
            and assign high-priority SLA tracking.
          </p>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Escalation Reason & Notes *
            </label>
            <textarea
              rows={3}
              value={escalateModal.reason}
              onChange={(e) =>
                setEscalateModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="e.g. Imminent perishable produce spoilage, buyer threatening transaction chargeback..."
              className="w-full text-xs border border-gray-300 rounded-none p-2.5 bg-white text-gray-900 focus:outline-none focus:border-red-600"
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

