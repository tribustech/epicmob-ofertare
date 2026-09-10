'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/** <select> care scrie valoarea într-un parametru de URL (filtre pe pagini server). */
export function ParamSelect({ param, options, allLabel }: {
  param: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get(param) ?? '';
  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        if (e.target.value) next.set(param, e.target.value); else next.delete(param);
        router.push(`?${next.toString()}`);
      }}
      className="h-7 rounded-lg border border-input bg-card px-2 text-[12.8px] outline-none"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
