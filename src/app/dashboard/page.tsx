'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/dashboard/AuthProvider';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/SeverityBadge';
import type { PhishingIncident } from '@/types/dashboard';

interface Stats {
  total: number;
  open: number;
  critical: number;
  resolvedToday: number;
}

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? 'text-gray-100'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<PhishingIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/dashboard/login');
      return;
    }
    if (!user) return;

    async function load() {
      const { data: incidents } = await supabase
        .from('phishing_incidents')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (!incidents) { setLoading(false); return; }

      const today = new Date().toISOString().slice(0, 10);
      setStats({
        total: incidents.length,
        open: incidents.filter((i) => i.status === 'new' || i.status === 'in_progress').length,
        critical: incidents.filter((i) => i.severity === 'critical').length,
        resolvedToday: incidents.filter((i) => i.resolved_at?.startsWith(today)).length,
      });
      setRecent(incidents.slice(0, 8));
      setLoading(false);
    }

    load();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-100">Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Phishing incident summary</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Incidents" value={stats?.total ?? 0} />
        <StatCard label="Open" value={stats?.open ?? 0} sub="new + in progress" accent="text-yellow-300" />
        <StatCard label="Critical" value={stats?.critical ?? 0} accent="text-red-400" />
        <StatCard label="Resolved Today" value={stats?.resolvedToday ?? 0} accent="text-emerald-400" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-100">Recent Incidents</h2>
          <Link href="/dashboard/incidents" className="text-xs text-emerald-400 hover:text-emerald-300">
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 text-sm">No incidents logged yet.</p>
            <Link href="/dashboard/incidents/new" className="inline-block mt-3 text-xs text-emerald-400 hover:text-emerald-300">
              Log your first incident →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {recent.map((incident) => (
              <Link
                key={incident.id}
                href={`/dashboard/incidents/${incident.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{incident.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {incident.sender_ip ? `IP: ${incident.sender_ip} · ` : ''}
                    {new Date(incident.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge status={incident.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
