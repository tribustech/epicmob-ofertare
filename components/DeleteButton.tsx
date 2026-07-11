'use client';

export function DeleteButton({ action, label }: { action: () => Promise<void>; label?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Sigur ștergi această intrare?')) e.preventDefault();
      }}
    >
      <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
        {label ?? 'Șterge'}
      </button>
    </form>
  );
}
