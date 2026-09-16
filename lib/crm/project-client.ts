/** Decizia la editarea câmpului „Client" (text liber) din pagina proiectului. Fără DB — testabil. */
export const normClientName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export type ClientChangePlan =
  | { kind: 'none' }
  | { kind: 'move'; clientId: string }              // numele există → proiectul trece pe acel client
  | { kind: 'rename'; clientId: string; name: string } // nume nou, proiectul are client → îl redenumim
  | { kind: 'create'; name: string };               // nume nou, proiect fără client → client nou

export function planClientChange(typed: string, currentClientId: string | null, clients: { id: string; name: string }[]): ClientChangePlan {
  const name = typed.trim().replace(/\s+/g, ' ');
  if (!name) return { kind: 'none' };
  const key = normClientName(name);
  const found = clients.find((c) => normClientName(c.name) === key);
  if (found) return found.id === currentClientId ? { kind: 'none' } : { kind: 'move', clientId: found.id };
  return currentClientId ? { kind: 'rename', clientId: currentClientId, name } : { kind: 'create', name };
}
