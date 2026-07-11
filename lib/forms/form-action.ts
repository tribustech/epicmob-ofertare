import { ZodError } from 'zod';

export interface FormState {
  error?: string;
}

function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'digest' in e &&
    String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')
  );
}

export function formAction<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
): (...args: A) => Promise<FormState> {
  return async (...args: A) => {
    try {
      await fn(...args);
      return {};
    } catch (e) {
      if (isNextRedirect(e)) throw e;
      if (e instanceof ZodError) {
        return { error: 'Date invalide: ' + e.issues.map((i) => i.message).join('; ') };
      }
      return { error: e instanceof Error ? e.message : 'Eroare necunoscută' };
    }
  };
}
