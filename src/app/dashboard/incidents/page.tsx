'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/dashboard/AuthProvider';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/SeverityBadge';
import type { PhishingIncident, Severity, IncidentStatus } from '@/types/dashboard';

const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];
const STATUSES: IncidentStatus[] = ['new', 'in_progress', 'resolved', 'escalated'];

export default function IncidentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [incidents, setIncidents] = useState<PhishingIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<Severity | ''>('');
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | ''>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/dashboard/login');
      return;
    }
    if (!user) return;

    async function load() {
      let query = supabase
        .from('phishing_incidents')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (filterSeverity) query = query.eq('severity', filterSeverity);
      if (filterStatus) query = query.eq('status', filterStatus);

      const { data } = await query;
      setIncidents(data ?? []);
      setLoading(false);
    }

    load();
  }, [user, authLoading, router, filterSeverity, filterStatus]);

  const filtered = search
    ? incidents.filter((i) =>
        i.title.toLowerCase().includes(search.toLowerCase()) ||
        i.sender_email?.toLowerCase().includes(search.toLowerCase()) ||
        i.sender_ip?.includes(search)
      )
    : incidents;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Incidents</h1>
          <p className="text-gray-400 text-sm mt-1">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/dashboard/incidents/new"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Log Incident
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search title, email, IP…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 w-56 transition-colors"
        />

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as Severity | '')}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-emerald-500 transition-colors"
        >
          <option value="">All Severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as IncidentStatus | '')}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-emerald-500 transition-colors"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>

        {(filterSeverity || filterStatus || search) && (
          <button
            onClick={() => { setFilterSeverity(''); setFilterStatus(''); setSearch(''); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">No incidents found.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Sender IP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Analyst</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((incident) => (
                <tr
                  key={incident.id}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/dashboard/incidents/${incident.id}`)}
                >
                  <td className="px-4 py-3">
                    <p className="text-gray-100 font-medium truncate max-w-[200px]">{incident.title}</p>
                    {incident.sender_email && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[200px]">{incident.sender_email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={incident.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={incident.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-gray-400 font-mono text-xs">{incident.sender_ip ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-gray-400 text-xs">
                      {incident.profiles?.full_name ?? incident.profiles?.email ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(incident.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
