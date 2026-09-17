/** Ce împiedică ștergerea unui client. Ștergem doar fișele goale: un client cu proiecte sau
 *  documente ține de el istoricul de oferte și de bani, deci se marchează Pierdut, nu se șterge. */
export function clientDeleteBlocker(c: { name: string; projects: number; documents: number }): string | null {
  if (c.projects > 0) {
    return c.projects === 1
      ? `${c.name} are 1 proiect. Șterge întâi proiectul sau marchează clientul Pierdut.`
      : `${c.name} are ${c.projects} proiecte. Șterge întâi proiectele sau marchează clientul Pierdut.`;
  }
  if (c.documents > 0) {
    return c.documents === 1
      ? `${c.name} are 1 document în Finanțe. Marchează clientul Pierdut în loc să-l ștergi.`
      : `${c.name} are ${c.documents} documente în Finanțe. Marchează clientul Pierdut în loc să-l ștergi.`;
  }
  return null;
}
