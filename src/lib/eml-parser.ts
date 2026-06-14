import type { EmlParseResult } from '@/types/dashboard';

function parseHeaderSection(headerSection: string): Map<string, string[]> {
  // Unfold multi-line headers (RFC 2822 — continuation lines start with whitespace)
  const unfolded = headerSection.replace(/\r?\n[ \t]+/g, ' ');
  const lines = unfolded.split(/\r?\n/);
  const headers = new Map<string, string[]>();

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (!headers.has(key)) headers.set(key, []);
    headers.get(key)!.push(value);
  }

  return headers;
}

function isPrivateIp(ip: string): boolean {
  const p = ip.split('.').map(Number);
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168)
  );
}

function extractSenderIp(receivedHeaders: string[]): string | null {
  const ipRe = /\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/;
  // Walk from bottom of chain (external sender) upward
  for (let i = receivedHeaders.length - 1; i >= 0; i--) {
    const match = receivedHeaders[i].match(ipRe);
    if (match && !isPrivateIp(match[1])) return match[1];
  }
  // Fall back to any IP in the chain
  for (let i = receivedHeaders.length - 1; i >= 0; i--) {
    const match = receivedHeaders[i].match(ipRe);
    if (match) return match[1];
  }
  return null;
}

function extractUrls(text: string): string[] {
  const urlRe = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const found = text.match(urlRe) ?? [];
  return [...new Set(found)];
}

export function parseEml(emlContent: string): EmlParseResult {
  const normalized = emlContent.replace(/\r\n/g, '\n');
  const blankLine = normalized.indexOf('\n\n');
  const headerSection = blankLine !== -1 ? normalized.slice(0, blankLine) : normalized;
  const body = blankLine !== -1 ? normalized.slice(blankLine + 2) : '';

  const headerMap = parseHeaderSection(headerSection);
  const senderIp = extractSenderIp(headerMap.get('received') ?? []);
  const suspiciousUrls = extractUrls(body);

  const headers: Record<string, string> = {};
  for (const [key, values] of headerMap.entries()) {
    headers[key] = values[0];
  }

  return {
    from: headerMap.get('from')?.[0] ?? null,
    to: headerMap.get('to')?.[0] ?? null,
    subject: headerMap.get('subject')?.[0] ?? null,
    replyTo: headerMap.get('reply-to')?.[0] ?? null,
    senderIp,
    suspiciousUrls,
    headers,
    rawHeaders: headerSection,
  };
}
