# Picioare scăzute din înălțime + calcul vizibil pe piesă

**Data:** 2026-07-16
**Status:** aprobat

## Problemă

1. Înălțimea piciorului (`legHeightMm`, definită pe asamblare) nu se scade din piesele
   verticale ale carcasei. Azi `legHeightMm` alege doar produsul de picior; lateralele și
   spatele folosesc înălțimea totală `H`, deci corpul iese prea înalt.
2. Utilizatorul nu vede de unde vine o dimensiune. La click pe o piesă vrea derivarea
   („ce s-a scăzut").

## Decizii

- **Ce piese scad cu piciorul:** Laterală **și** Spate (ambele depind de înălțime).
  Blat/fund corp și polița sunt orizontale — neatinse.
- **Tipuri cu picior:** `BAZA`, `INALT`, `COLT` (`LEGGED_TYPES`). Restul nu scad nimic.
- **Afișare calcul:** rând extensibil sub piesa apăsată, în tabelul „Piese generate".

## 1. Geometrie — scăderea piciorului

`legHeightMm` NU intră în `CabinetInput` (e la nivel de asamblare). Se transmite ca al
**4-lea parametru opțional**:

```
expandCabinet(input, catalogs, cc, legHeightMm?) → expandCarcass(input, catalogs, cc, legHeightMm?)
```

Default = fără scădere (păstrează comportamentul `computeProject` din `lib/engine/index.ts`,
care nu are `legHeightMm`).

În `expandCarcass`:

```
const legDeduct = (legHeightMm && LEGGED_TYPES.has(input.type)) ? legHeightMm : 0;
sideH   = H − (aplicat top ? t : 0) − (aplicat bottom ? t : 0) − legDeduct
spateH  = (falt ? H − backRebate : H) − legDeduct
```

`LEGGED_TYPES` se mută în `lib/engine/constants.ts` și se importă în `carcass.ts` + `hardware.ts`.

Căile reale de cost transmit valoarea (scăderea intră în material + nesting, nu doar afișaj):
- `lib/quote/compute.ts` — `normal[i].legHeightMm`
- `lib/quote/estimate.ts` — `opts.legHeightMm`
- `components/CabinetEditorForm.tsx` — prop `legHeightMm`

`assertPositiveDim` rămâne garda: un picior mai mare decât corpul aruncă eroare de dimensiune.

## 2. Urma de calcul (structurată, pe Part)

În `lib/engine/types.ts`:

```ts
export interface DimTerm { label: string; valueMm: number; } // semnat: negativ = scăzut
export interface DimCalc { label: string; resultMm: number; terms: DimTerm[]; }
// Part.calc?: { length?: DimCalc; width?: DimCalc }
```

Câmp opțional → nesting/costing/cutlist îl ignoră. `expandCarcass` completează `calc` doar
pentru piesele carcasei:

- **Laterală** `length` = `Înălțime`: `H − blat aplicat? − fund aplicat? − picior?`;
  `width` = `Adâncime`: `D`.
- **Blat/Fund corp** `length` = `Lățime`: `W` (aplicat) sau `W − 2×grosime` (încadrat);
  `width` = `Adâncime`: `D`.
- **Poliță** `Lățime interioară` (`W − 2×grosime`) și `Adâncime` (`D − retragere`).
- **Spate** `Înălțime`: `H − falt? − picior?`; `Lățime`: `W − falt?`.

**Scop:** doar piese de carcasă. Fronturile/sertarele afișează dimensiunile brute (fără urmă).

## 3. UI — rând extensibil

În tabelul „Piese generate" (`CabinetEditorForm.tsx`):
- `useState` pentru indexul rândului deschis; click pe rând comută.
- Rândul de detaliu (colSpan) randează fiecare `DimCalc`:
  `{label}: {t0} {|v0|} − {t1} {|v1|} … = {result}` (primul termen pozitiv, restul cu semn).
- Piese fără `calc` → linie simplă `Lungime: … · Lățime: …`.

## Teste

- `carcass.test.ts`: laterală și spate scad cu `legHeightMm` doar pentru tipuri cu picior;
  fără `legHeightMm` sau tip nelegat → neschimbat; `calc.terms` corecte pentru fiecare piesă.
- Testele existente (fără al 4-lea param) rămân verzi.
