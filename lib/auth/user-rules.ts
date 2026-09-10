/** Reguli pure pentru administrarea utilizatorilor (toți sunt admin). */

export function deactivateError(args: {
  targetId: string;
  currentUserId: string;
  activeCount: number;
  targetActive: boolean;
}): string | null {
  if (!args.targetActive) return null;
  if (args.targetId === args.currentUserId) return 'Nu te poți dezactiva pe tine.';
  if (args.activeCount <= 1) return 'Nu poți dezactiva ultimul utilizator activ.';
  return null;
}
