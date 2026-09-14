// components/calendar/EventForm.tsx
// Formularul de eveniment manual: folosit la criere (fără eventId) și la editare (cu eventId + ștergere).
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { Select, SubmitButton, TextArea, TextInput } from '@/components/forms';
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/lib/calendar/actions';

export interface EventDefaults { title?: string; date?: string; time?: string | null; projectId?: string | null; note?: string | null }

export function EventForm({ projectOptions, defaults, eventId }: {
  projectOptions: { value: string; label: string }[];
  defaults?: EventDefaults;
  eventId?: string;
}) {
  const action = eventId ? updateCalendarEvent.bind(null, eventId) : createCalendarEvent;
  return (
    <div className="grid gap-4">
      <ActionForm action={action} className="grid gap-4">
        <TextInput name="title" label="Titlu" defaultValue={defaults?.title} placeholder="Montaj Popescu" />
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="date" label="Ziua" type="date" defaultValue={defaults?.date} mono />
          <TextInput name="time" label="Ora (opțional)" type="time" defaultValue={defaults?.time} required={false} mono />
        </div>
        <Select name="projectId" label="Proiect (opțional)" options={projectOptions} defaultValue={defaults?.projectId} allowEmpty />
        <TextArea name="note" label="Notă" defaultValue={defaults?.note} rows={2} />
        <div><SubmitButton>{eventId ? 'Salvează' : 'Adaugă'}</SubmitButton></div>
      </ActionForm>
      {eventId && (
        <div className="border-t pt-3">
          <DeleteButton action={deleteCalendarEvent.bind(null, eventId)} label="Șterge evenimentul" confirmMessage="Sigur ștergi acest eveniment?" />
        </div>
      )}
    </div>
  );
}
