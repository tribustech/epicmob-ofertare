# Corp nou fără valori predefinite — design

Data: 2026-07-16 · Aprobat de Andrew în sesiune.

## Problemă

„Adaugă corp" creează instant corpul în DB cu valori inventate — 600×720×560 mm,
primul PAL alfabetic drept carcasă **și** front, primul cant (cel mai subțire),
spate PFL — apoi redirecționează la editor. Un corp „uitat" cu aceste valori
intră în calculul ofertei fără ca cineva să le fi ales.

## Comportament nou

„Adaugă corp" devine link către o pagină nouă `Corp nou`
(`/proiecte/[id]/corp/nou?ansamblu=<assemblyId>`) care folosește același
`CabinetEditorForm`, dar corpul se creează în DB **abia la salvare**, după ce
formularul trece validarea `cabinetFormSchema` (dimensiuni pozitive, materiale
și cant alese).

### Stare inițială a formularului

- **Goale:** L / H / A, material carcasă, material fronturi, material spate,
  cant carcasă, cant fronturi.
- **Precompletate (structurale):** eticheta `C{n+1}`, tip „Bază", fronturi
  „Uși", „Cu polițe", spate activat (fălț), montaj Încadrat sus/jos, sistem
  sertare Tandembox, mâner „ca proiectul", front PAL.
- Estimarea live apare doar când formularul e valid (mecanism existent:
  `parsed.success`).
- Secțiunile Feronerie și Piese suplimentare afișează „Disponibil după
  salvarea corpului" (cer un `cabinetId` existent).

### Salvare

Acțiune nouă `createCabinet(projectId, assemblyId, values)` în
`lib/quote/actions.ts`: validează assembly-ul (aparține proiectului),
parsează `cabinetFormSchema` → `toCabinetInput`, creează corpul cu
`sortOrder = count`, revalidate + redirect la `/proiecte/[id]/corp/[cabinetId]`.
Vechiul `addCabinet` (cu defaults hardcodate) se șterge.

`duplicateCabinet` rămâne neschimbat — copierea valorilor de la un corp
existent are sens.

## Fișiere atinse

- `app/proiecte/[id]/page.tsx` — butonul „Adaugă corp" devine link.
- `app/proiecte/[id]/corp/nou/page.tsx` — pagină nouă.
- Helper comun pentru datele de pagină partajate cu
  `corp/[cabinetId]/page.tsx` (snapshot, opțiuni materiale/canturi/feronerie,
  furnizori/modele MDF, RAL).
- `lib/quote/actions.ts` — `createCabinet` nou, `addCabinet` șters.

## Testare

Fără teste noi (directiva din 2026-07-14). Gate: `tsc` + `next build` + smoke
manual în browser: corp nou gol → validare blochează salvarea incompletă →
salvare validă creează corpul și redirecționează; oferta nu conține corpuri
nesalvate.
