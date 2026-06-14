import type { Severity, IncidentStatus } from '@/types/dashboard';

const SEVERITY_STYLES: Record<Severity, string> = {
  low:      'bg-blue-900/50 text-blue-300 border border-blue-700',
  medium:   'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  high:     'bg-orange-900/50 text-orange-300 border border-orange-700',
  critical: 'bg-red-900/50 text-red-300 border border-red-700',
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  new:         'bg-purple-900/50 text-purple-300 border border-purple-700',
  in_progress: 'bg-blue-900/50 text-blue-300 border border-blue-700',
  resolved:    'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
  escalated:   'bg-red-900/50 text-red-300 border border-red-700',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const label = status.replace('_', ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize tracking-wide ${STATUS_STYLES[status]}`}>
      {label}
    </span>
  );
}
