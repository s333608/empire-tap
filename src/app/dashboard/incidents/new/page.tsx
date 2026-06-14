'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/dashboard/AuthProvider';
import type { Severity, IncidentStatus, EmlParseResult } from '@/types/dashboard';

const SEVERITY_OPTIONS: { value: Severity; label: string; desc: string }[] = [
  { value: 'low',      label: 'Low',      desc: 'Suspicious but unlikely harmful' },
  { value: 'medium',   label: 'Medium',   desc: 'Credible threat, no impact yet' },
  { value: 'high',     label: 'High',     desc: 'Active threat, potential impact' },
  { value: 'critical', label: 'Critical', desc: 'Confirmed attack or data at risk' },
];

export default function NewIncidentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as Severity,
    status: 'new' as IncidentStatus,
    sender_email: '',
    sender_ip: '',
    target_email: '',
    attachments_present: false,
    suspicious_urls: [] as string[],
    raw_headers: '',
  });

  const [urlInput, setUrlInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<EmlParseResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleEmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch('/api/dashboard/parse-eml', { method: 'POST', body });
      const data: { result?: EmlParseResult; error?: string } = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.result) {
        const r = data.result;
        setParsed(r);
        setForm((prev) => ({
          ...prev,
          sender_email: r.from ?? prev.sender_email,
          sender_ip: r.senderIp ?? prev.sender_ip,
          target_email: r.to ?? prev.target_email,
          suspicious_urls: r.suspiciousUrls.length ? r.suspiciousUrls : prev.suspicious_urls,
          raw_headers: r.rawHeaders,
          title: prev.title || (r.subject ? `Phishing: ${r.subject}` : prev.title),
        }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse .eml file');
    } finally {
      setParsing(false);
    }
  }

  function addUrl() {
    const url = urlInput.trim();
    if (url && !form.suspicious_urls.includes(url)) {
      set('suspicious_urls', [...form.suspicious_urls, url]);
    }
    setUrlInput('');
  }

  function removeUrl(url: string) {
    set('suspicious_urls', form.suspicious_urls.filter((u) => u !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setError('');
    setSubmitting(true);

    const { data, error: err } = await supabase
      .from('phishing_incidents')
      .insert({
        reported_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        severity: form.severity,
        status: form.status,
        sender_email: form.sender_email.trim() || null,
        sender_ip: form.sender_ip.trim() || null,
        target_email: form.target_email.trim() || null,
        attachments_present: form.attachments_present,
        suspicious_urls: form.suspicious_urls,
        raw_headers: form.raw_headers || null,
      })
      .select()
      .single();

    setSubmitting(false);

    if (err) {
      setError(err.message);
      return;
    }

    router.push(`/dashboard/incidents/${data.id}`);
  }

  const inputClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors';

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-100">Log New Incident</h1>
        <p className="text-gray-400 text-sm mt-1">Record a phishing attempt for triage and tracking.</p>
      </div>

      {/* EML Upload */}
      <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-200 mb-1">Auto-parse from .eml file</p>
            <p className="text-xs text-gray-500">Upload a raw email file to automatically extract sender IP, URLs, and headers.</p>
          </div>
          <input ref={fileRef} type="file" accept=".eml,message/rfc822" className="hidden" onChange={handleEmlUpload} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="shrink-0 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {parsing ? 'Parsing…' : 'Upload .eml'}
          </button>
        </div>

        {parsed && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            {parsed.from && (
              <div className="bg-gray-800 rounded-lg p-2">
                <span className="text-gray-500">From</span>
                <p className="text-gray-200 mt-0.5 truncate">{parsed.from}</p>
              </div>
            )}
            {parsed.senderIp && (
              <div className="bg-gray-800 rounded-lg p-2">
                <span className="text-gray-500">Origin IP</span>
                <p className="text-emerald-300 font-mono mt-0.5">{parsed.senderIp}</p>
              </div>
            )}
            {parsed.subject && (
              <div className="bg-gray-800 rounded-lg p-2 col-span-2">
                <span className="text-gray-500">Subject</span>
                <p className="text-gray-200 mt-0.5">{parsed.subject}</p>
              </div>
            )}
            {parsed.suspiciousUrls.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-2 col-span-2">
                <span className="text-gray-500">URLs found ({parsed.suspiciousUrls.length})</span>
                <div className="mt-1 space-y-0.5">
                  {parsed.suspiciousUrls.slice(0, 5).map((url) => (
                    <p key={url} className="text-yellow-300 truncate">{url}</p>
                  ))}
                  {parsed.suspiciousUrls.length > 5 && (
                    <p className="text-gray-500">+{parsed.suspiciousUrls.length - 5} more (added automatically)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Credential harvesting via fake Microsoft login"
            className={inputClass}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Describe the phishing attempt, indicators of compromise, and any context…"
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Severity <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SEVERITY_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('severity', value)}
                className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                  form.severity === value
                    ? value === 'critical' ? 'border-red-500 bg-red-900/30 text-red-300'
                    : value === 'high' ? 'border-orange-500 bg-orange-900/30 text-orange-300'
                    : value === 'medium' ? 'border-yellow-500 bg-yellow-900/30 text-yellow-300'
                    : 'border-blue-500 bg-blue-900/30 text-blue-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                <p className="font-medium capitalize">{label}</p>
                <p className="mt-0.5 opacity-70 leading-tight">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Email fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Sender Email</label>
            <input
              type="email"
              value={form.sender_email}
              onChange={(e) => set('sender_email', e.target.value)}
              placeholder="attacker@evil.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Target Email</label>
            <input
              type="email"
              value={form.target_email}
              onChange={(e) => set('target_email', e.target.value)}
              placeholder="victim@company.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Sender IP */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Sender IP Address</label>
          <input
            type="text"
            value={form.sender_ip}
            onChange={(e) => set('sender_ip', e.target.value)}
            placeholder="185.220.101.42"
            className={`${inputClass} font-mono`}
          />
        </div>

        {/* Suspicious URLs */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Suspicious URLs</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
              placeholder="https://phish.example.com/login"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={addUrl}
              className="shrink-0 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          {form.suspicious_urls.length > 0 && (
            <div className="space-y-1.5">
              {form.suspicious_urls.map((url) => (
                <div key={url} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
                  <span className="text-yellow-300 text-xs font-mono flex-1 truncate">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeUrl(url)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attachments */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.attachments_present}
            onChange={(e) => set('attachments_present', e.target.checked)}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm text-gray-300">Email contained attachments</span>
        </label>

        {/* Raw headers (collapsible) */}
        {form.raw_headers && (
          <details className="bg-gray-800 border border-gray-700 rounded-lg">
            <summary className="px-4 py-3 text-xs text-gray-400 cursor-pointer select-none hover:text-gray-200">
              Raw Email Headers (parsed from .eml)
            </summary>
            <pre className="px-4 pb-4 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
              {form.raw_headers}
            </pre>
          </details>
        )}

        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Saving…' : 'Log Incident'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
