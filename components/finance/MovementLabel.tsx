import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { signedAmount } from '@/lib/finance/balance';
import { DOCUMENT_KIND_LABELS, INCOME_TYPE_LABELS, MOVEMENT_TYPE_LABELS, type DocumentKind, type MovementType } from '@/lib/finance/constants';
import type { MovementRow } from '@/lib/finance/account-queries';

/** Ce explică o mișcare: documentul, împrumutul, proiectul, contra-contul sau motivul ajustării. */
export function movementDescription(m: MovementRow): { text: string; href?: string } {
  if (m.document) {
    const kind = DOCUMENT_KIND_LABELS[m.document.kind as DocumentKind] ?? m.document.kind;
    return { text: `${m.document.counterparty} · ${kind}${m.document.number ? ` ${m.document.number}` : ''}`, href: `/finante/cheltuieli?doc=${m.document.id}` };
  }
  if (m.loan) return { text: `${m.type === 'IN' ? 'Împrumut de la' : 'Returnare către'} ${m.loan.lenderName}`, href: '/finante/imprumuturi' };
  if (m.project) {
    const t = m.incomeType ? INCOME_TYPE_LABELS[m.incomeType as keyof typeof INCOME_TYPE_LABELS] ?? m.incomeType : 'Încasare';
    return { text: `${t} · ${m.project.name}`, href: `/proiecte/${m.project.id}?tab=bani` };
  }
  if (m.counterAccount) return { text: `${m.type === 'TRANSFER_OUT' ? 'către' : 'din'} ${m.counterAccount.name}`, href: `/finante/conturi/${m.counterAccount.id}` };
  if (m.type === 'ADJUSTMENT') return { text: `Ajustare: ${m.adjustmentReason ?? ''}` };
  return { text: m.note ?? MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type };
}

export function SignedAmount({ type, amount, className }: { type: string; amount: number; className?: string }) {
  const v = signedAmount({ type, amount });
  return (
    <span className={cn('font-mono tabular-nums', v > 0 ? 'text-emerald-700' : v < 0 ? 'text-foreground' : 'text-muted-foreground', className)}>
      {v > 0 ? '+' : v < 0 ? '−' : ''}{fmtLei(Math.abs(v))}
    </span>
  );
}

export function MovementText({ m }: { m: MovementRow }) {
  const d = movementDescription(m);
  return d.href ? <Link href={d.href} className="hover:underline">{d.text}</Link> : <span>{d.text}</span>;
}
