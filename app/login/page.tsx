import { login } from '@/lib/auth/actions';
import { safeNextPath } from '@/lib/auth/next-path';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton, TextInput } from '@/components/forms';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-[380px] rounded-xl bg-card p-7 ring-1 ring-border">
        <div className="mb-6">
          <div className="text-[17px] font-bold tracking-tight">
            EpicMob <span className="font-medium text-muted-foreground">Ofertare</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Intră în cont ca să continui.</p>
        </div>
        <ActionForm action={login} className="grid gap-4">
          <input type="hidden" name="next" value={safeNextPath(next)} />
          <TextInput name="email" label="Email" type="email" autoComplete="username" />
          <TextInput name="password" label="Parolă" type="password" autoComplete="current-password" />
          <div className="pt-1">
            <SubmitButton>Intră</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
