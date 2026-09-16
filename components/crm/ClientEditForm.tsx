import { CLIENT_KIND_LABELS } from '@/lib/crm/constants';
import { updateClient } from '@/lib/crm/client-actions';
import { ActionForm } from '@/components/ActionForm';
import { Select, SubmitButton, TextArea, TextInput } from '@/components/forms';

export interface ClientEditable {
  id: string; name: string; kind: string; phone: string | null; email: string | null; address: string | null; cui: string | null;
  source: string | null; wants: string | null; budgetEstimate: number | null;
}

/** Formularul „Editează clientul/leadul" (server) — folosit pe pagina clientului și pe dashboard. */
export function ClientEditForm({ client, sources }: { client: ClientEditable; sources: { name: string }[] }) {
  const sourceOptions = sources.map((s) => ({ value: s.name, label: s.name }));
  const kindOptions = Object.entries(CLIENT_KIND_LABELS).map(([value, label]) => ({ value, label }));
  return (
    <ActionForm action={updateClient.bind(null, client.id)} className="grid gap-4">
      <TextInput name="name" label="Nume" defaultValue={client.name} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput name="phone" label="Telefon" type="tel" defaultValue={client.phone} required={false} mono />
        <Select name="kind" label="Tip" options={kindOptions} defaultValue={client.kind} />
      </div>
      <TextInput name="email" label="Email" type="email" defaultValue={client.email} required={false} />
      <TextInput name="address" label="Adresă" defaultValue={client.address} required={false} />
      <TextInput name="cui" label="CUI (firmă)" defaultValue={client.cui} required={false} mono />
      <div className="grid grid-cols-2 gap-3 border-t pt-4">
        <Select name="source" label="Sursă" options={sourceOptions} defaultValue={client.source} allowEmpty />
        <TextInput name="budgetEstimate" label="Buget estimat (lei)" defaultValue={client.budgetEstimate != null ? String(client.budgetEstimate) : ''} required={false} mono />
      </div>
      <TextArea name="wants" label="Ce vrea" defaultValue={client.wants} />
      <div className="pt-1"><SubmitButton>Salvează</SubmitButton></div>
    </ActionForm>
  );
}
