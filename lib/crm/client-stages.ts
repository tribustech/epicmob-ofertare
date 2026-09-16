/** Cine apare în ce listă. Un lead calificat pleacă din Leaduri și apare la Clienți:
 *  calificarea înseamnă că lucrezi deja cu el (i-ai deschis proiect sau ofertă). */
import type { ClientStage } from './constants';

/** Tabul „Activi" din Leaduri: doar leadurile necalificate. */
export const LEAD_ACTIVE_STAGES: ClientStage[] = ['LEAD'];

/** Pagina Clienți: calificați și clienți cu contract. */
export const CLIENTS_STAGES: ClientStage[] = ['CALIFICAT', 'CLIENT'];

/** „De contactat" în dashboard: oricine are o următoare acțiune stabilită, lead sau client. */
export const NEXT_ACTION_STAGES: ClientStage[] = ['LEAD', 'CALIFICAT', 'CLIENT'];
