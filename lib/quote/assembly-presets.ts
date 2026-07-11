// Preselecții pentru formularul „Ansamblu nou": un `<select>` de nume și unul de
// înălțime picior, fiecare însoțit de un câmp liber opțional. Rezolvarea (server-side,
// fără JS) e făcută în `addAssembly`: câmpul liber câștigă dacă e completat, altfel
// se folosește preselecția. Fișier separat (nu în actions.ts, care e "use server" și
// nu poate exporta altceva decât funcții async) ca să poată fi importat și din UI.
export const ASSEMBLY_NAME_PRESETS = ['Bucătărie', 'Dressing', 'Corp baie', 'Living', 'Hol', 'Altul'] as const;
export const ASSEMBLY_LEG_HEIGHT_PRESETS = ['100', '150'] as const;
