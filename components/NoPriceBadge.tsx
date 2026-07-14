/** Marcaj compact pentru materiale fără preț în catalog — vizibil și la print. */
export function NoPriceBadge() {
  return (
    <span className="inline-flex items-center rounded border border-amber-400 bg-amber-50 px-1 text-[10px] font-medium leading-4 text-amber-800">
      fără preț
    </span>
  );
}
