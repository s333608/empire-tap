'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/dashboard/AuthProvider';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/SeverityBadge';
import type { PhishingIncident, IncidentStatus } from '@/types/dashboard';

const STATUS_OPTIONS: IncidentStatus[] = ['new', 'in_progress', 'resolved', 'escalated'];

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [incident, setIncident] = useState<PhishingIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusDraft, setStatusDraft] = useState<IncidentStatus>('new');

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/dashboard/login'); return; }
    if (!user || !id) return;

    async function load() {
      const { data } = await supabase
        .from('phishing_incidents')
        .select('*, profiles(full_name, email)')
        .eq('id', id)
        .single();

      if (data) {
        setIncident(data);
        setStatusDraft(data.status);
      }
      setLoading(false);
    }

    load();
  }, [user, authLoading, router, id]);

  async function updateStatus() {
    if (!incident) return;
    setUpdating(true);
    const updates: Record<string, unknown> = { status: statusDraft };
    if (statusDraft === 'resolved') updates.resolved_at = new Date().toISOString();
    else if (incident.status === 'resolved') updates.resolved_at = null;

    const { data, error } = await supabase
      .from('phishing_incidents')
      .update(updates)
      .eq('id', incident.id)
      .select()
      .single();

    setUpdating(false);
    if (!error && data) setIncident(data);
  }

  async function handleDelete() {
    if (!incident || !confirm(`Delete "${incident.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    await supabase.from('phishing_incidents').delete().eq('id', incident.id);
    router.push('/dashboard/incidents');
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Incident not found.</p>
        <Link href="/dashboard/incidents" className="text-emerald-400 text-sm mt-3 inline-block">
          ← Back to incidents
        </Link>
      </div>
    );
  }

  const canEdit = profile?.role === 'admin' || user?.id === incident.reported_by;
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard/incidents" className="hover:text-emerald-400 transition-colors">Incidents</Link>
        <span>/</span>
        <span className="text-gray-300 truncate">{incident.title}</span>
      </div>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-lg font-bold text-gray-100 leading-snug">{incident.title}</h1>
          <div className="flex gap-2 shrink-0">
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
        </div>

        {incident.description && (
          <p className="text-gray-300 text-sm leading-relaxed mb-4">{incident.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Sender Email" value={incident.sender_email} mono />
          <Field label="Sender IP" value={incident.sender_ip} mono accent="text-yellow-300" />
          <Field label="Target Email" value={incident.target_email} mono />
          <Field label="Attachments" value={incident.attachments_present ? 'Yes' : 'No'} />
          <Field
            label="Reported by"
            value={incident.profiles?.full_name ?? incident.profiles?.email ?? '—'}
          />
          <Field
            label="Created"
            value={new Date(incident.created_at).toLocaleString()}
          />
          {incident.resolved_at && (
            <Field label="Resolved" value={new Date(incident.resolved_at).toLocaleString()} />
          )}
        </div>
      </div>

      {/* Suspicious URLs */}
      {incident.suspicious_urls && incident.suspicious_urls.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Suspicious URLs
            <span className="ml-2 text-xs text-gray-500 font-normal">({incident.suspicious_urls.length})</span>
          </h2>
          <div className="space-y-2">
            {incident.suspicious_urls.map((url, i) => (
              <div key={i} className="bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-red-400 text-xs shrink-0">⚠</span>
                <span className="text-yellow-300 text-xs font-mono break-all">{url}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Headers */}
      {incident.raw_headers && (
        <details className="bg-gray-900 border border-gray-800 rounded-xl mb-4">
          <summary className="px-5 py-4 text-sm font-semibold text-gray-200 cursor-pointer select-none hover:text-gray-100">
            Email Headers
          </summary>
          <pre className="px-5 pb-5 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap break-all border-t border-gray-800 pt-4">
            {incident.raw_headers}
          </pre>
        </details>
      )}

      {/* Actions */}
      {canEdit && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Update Status</h2>
          <div className="flex gap-3">
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as IncidentStatus)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500 transition-colors flex-1"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <button
              onClick={updateStatus}
              disabled={updating || statusDraft === incident.status}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {updating ? 'Saving…' : 'Update'}
            </button>
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-900/40 hover:bg-red-900/70 border border-red-800/50 text-red-400 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm ${accent ?? 'text-gray-200'} ${mono ? 'font-mono' : ''} break-all`}>
        {value || '—'}
      </p>
    </div>
  );
}
