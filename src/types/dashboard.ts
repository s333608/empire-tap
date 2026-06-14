export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'new' | 'in_progress' | 'resolved' | 'escalated';
export type UserRole = 'analyst' | 'admin';

export interface PhishingIncident {
  id: string;
  reported_by: string | null;
  title: string;
  description: string | null;
  sender_email: string | null;
  sender_ip: string | null;
  suspicious_urls: string[] | null;
  severity: Severity;
  status: IncidentStatus;
  target_email: string | null;
  raw_headers: string | null;
  attachments_present: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface EmlParseResult {
  from: string | null;
  to: string | null;
  subject: string | null;
  replyTo: string | null;
  senderIp: string | null;
  suspiciousUrls: string[];
  headers: Record<string, string>;
  rawHeaders: string;
}
