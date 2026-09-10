/** Constante CRM: stage-uri client, statusuri proiect, etichete și pill-uri. Valorile sunt String în DB. */

export const CLIENT_STAGES = ['LEAD', 'CALIFICAT', 'CLIENT', 'PIERDUT'] as const;
export type ClientStage = (typeof CLIENT_STAGES)[number];

export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
  LEAD: 'Lead', CALIFICAT: 'Calificat', CLIENT: 'Client', PIERDUT: 'Pierdut',
};

export const CLIENT_STAGE_PILL: Record<ClientStage, string> = {
  LEAD: 'border border-accent-blue-border bg-accent-blue text-accent-blue-foreground',
  CALIFICAT: 'border border-amber-200 bg-amber-50 text-amber-700',
  CLIENT: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  PIERDUT: 'bg-muted text-muted-foreground',
};

export const CLIENT_KINDS = ['PERSOANA', 'FIRMA'] as const;
export const CLIENT_KIND_LABELS: Record<(typeof CLIENT_KINDS)[number], string> = { PERSOANA: 'Persoană', FIRMA: 'Firmă' };

export const LOST_REASONS = ['PRET', 'TIMING', 'CONCURENTA', 'FARA_RASPUNS', 'ALTUL'] as const;
export const LOST_REASON_LABELS: Record<(typeof LOST_REASONS)[number], string> = {
  PRET: 'Preț', TIMING: 'Timing', CONCURENTA: 'Concurență', FARA_RASPUNS: 'Fără răspuns', ALTUL: 'Altul',
};

export const PROJECT_STATUSES = ['OFERTARE', 'ACCEPTAT', 'IN_PRODUCTIE', 'MONTAT', 'INCHIS', 'PIERDUT'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  OFERTARE: 'Ofertare', ACCEPTAT: 'Acceptat', IN_PRODUCTIE: 'În producție', MONTAT: 'Montat', INCHIS: 'Închis', PIERDUT: 'Pierdut',
};

/** „Trece la…": următoarea stare în fluxul normal (PIERDUT e posibil din orice stare, separat). */
export const NEXT_PROJECT_STATUS: Partial<Record<ProjectStatus, ProjectStatus>> = {
  OFERTARE: 'ACCEPTAT', ACCEPTAT: 'IN_PRODUCTIE', IN_PRODUCTIE: 'MONTAT', MONTAT: 'INCHIS',
};

export const PROJECT_STATUS_PILL: Record<ProjectStatus, string> = {
  OFERTARE: 'border border-accent-blue-border bg-accent-blue text-accent-blue-foreground',
  ACCEPTAT: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  IN_PRODUCTIE: 'border border-amber-200 bg-amber-50 text-amber-700',
  MONTAT: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  INCHIS: 'bg-muted text-muted-foreground',
  PIERDUT: 'bg-muted text-muted-foreground',
};

/** Tipuri de evenimente din timeline + eticheta afișată. */
export const EVENT_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'a creat leadul',
  CLIENT_STAGE: 'a schimbat stadiul',
  CLIENT_UPDATED: 'a editat datele de contact',
  NEXT_ACTION: 'a setat următoarea acțiune',
  REMARKETING: 'a schimbat remarketing',
  PROJECT_CREATED: 'a creat proiectul',
  PROJECT_STATUS: 'a schimbat starea proiectului',
  DEADLINE_CHANGED: 'a schimbat deadline-ul',
  QUOTE_CREATED: 'a creat o ofertă',
  QUOTE_SENT: 'a trimis oferta',
  QUOTE_ACCEPTED: 'a acceptat oferta',
  QUOTE_REJECTED: 'a respins oferta',
  QUOTE_MOVED: 'a mutat o ofertă aici',
  DOCUMENT_ADDED: 'a alocat o cheltuială',
  PAYMENT: 'a înregistrat o plată',
  RECEIPT: 'a înregistrat o încasare',
  CONTRACT_CHANGE: 'a modificat contractul',
};

export const PILL_BASE = 'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap';
