/** Cine apare în ce listă. Trecerea din Leaduri la Clienți se face la acceptarea ofertei,
 *  nu la calificare: până semnează, omul e tot un lead, oricâte oferte i-ai făcut. */
import type { ClientStage } from './constants';

/** Tabul „Activi" din Leaduri: leaduri crude și calificate (au proiect sau ofertă, dar n-au semnat). */
export const LEAD_ACTIVE_STAGES: ClientStage[] = ['LEAD', 'CALIFICAT'];

/** Pagina Clienți: doar cine a acceptat o ofertă. Altfel lista s-ar umple de clienți care nu sunt clienți. */
export const CLIENTS_STAGES: ClientStage[] = ['CLIENT'];

/** „De contactat" în dashboard: oricine are o următoare acțiune stabilită, lead sau client. */
export const NEXT_ACTION_STAGES: ClientStage[] = ['LEAD', 'CALIFICAT', 'CLIENT'];
