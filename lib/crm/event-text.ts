import { fmtLei } from '@/lib/format';
import { fmtDate } from './dates';
import { CLIENT_STAGE_LABELS, EVENT_LABELS, LOST_REASON_LABELS, PROJECT_STATUS_LABELS, type ClientStage, type ProjectStatus } from './constants';

export type Payload = Record<string, unknown>;

/** Textul unui eveniment: eticheta („a acceptat oferta") + detaliul („v2 · 8.107 lei"). Un singur loc pentru client și proiect. */
export function eventText(type: string, p: Payload): { label: string; detail: string | null } {
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : null);
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
  const lost = (k: string) => (k ? LOST_REASON_LABELS[k as keyof typeof LOST_REASON_LABELS] ?? k : '');
  const label = EVENT_LABELS[type] ?? type.toLowerCase();

  switch (type) {
    case 'CLIENT_STAGE': {
      const lbl = (s: string | null) => (s ? CLIENT_STAGE_LABELS[s as ClientStage] ?? s : '?');
      const reason = str('reason');
      return { label, detail: `${lbl(str('from'))} → ${lbl(str('to'))}${reason ? ` · ${lost(reason)}` : ''}${str('note') ? ` · ${str('note')}` : ''}` };
    }
    case 'PROJECT_STATUS': {
      const lbl = (s: string | null) => (s ? PROJECT_STATUS_LABELS[s as ProjectStatus] ?? s : '?');
      const reason = str('reason');
      return { label, detail: `${lbl(str('from'))} → ${lbl(str('to'))}${reason ? ` · ${lost(reason)}` : ''}${str('note') ? ` · ${str('note')}` : ''}` };
    }
    case 'NEXT_ACTION': {
      const at = str('at');
      if (!at) return { label: 'a șters următoarea acțiune', detail: null };
      return { label, detail: `${fmtDate.format(new Date(at))}${str('note') ? ` · ${str('note')}` : ''}` };
    }
    case 'DEADLINE_CHANGED': {
      const from = str('from'); const to = str('to');
      return { label, detail: `${from ? fmtDate.format(new Date(from)) : 'fără'} → ${to ? fmtDate.format(new Date(to)) : 'fără'}` };
    }
    case 'REMARKETING':
      return { label, detail: p.on ? `da${str('note') ? ` · ${str('note')}` : ''}` : 'nu' };
    case 'CLIENT_CREATED':
      return { label, detail: str('source') ? `sursă ${str('source')}` : null };
    case 'QUOTE_ACCEPTED': {
      const price = num('price'); const rejected = num('rejected') ?? 0;
      return { label, detail: `v${num('version') ?? '?'}${price != null ? ` · ${fmtLei(price)}` : ''}${rejected > 0 ? ` · ${rejected} ${rejected === 1 ? 'ofertă respinsă' : 'oferte respinse'}` : ''}` };
    }
    case 'QUOTE_CREATED':
    case 'QUOTE_SENT':
      return { label, detail: num('version') != null ? `v${num('version')}` : null };
    case 'DOCUMENT_ADDED':
    case 'PAYMENT':
    case 'RECEIPT':
    case 'CONTRACT_CHANGE': {
      const amount = num('amount');
      const who = str('counterparty') ?? str('description') ?? null;
      return { label, detail: [who, amount != null ? fmtLei(amount) : null].filter(Boolean).join(' · ') || null };
    }
    default:
      return { label, detail: null };
  }
}

export function parsePayload(json: string): Payload {
  try { return JSON.parse(json) as Payload; } catch { return {}; }
}
