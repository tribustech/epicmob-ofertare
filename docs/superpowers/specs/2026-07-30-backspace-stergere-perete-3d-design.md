# Ștergerea peretelui 3D cu Backspace

## Scop

În editorul „Așezare 3D”, utilizatorul poate șterge peretele selectat apăsând
`Backspace`.

## Comportament

- `Backspace` șterge numai peretele selectat.
- Dacă este selectat un corp sau un element fix, `Backspace` nu îl șterge.
- Dacă focusul este într-un `input`, `textarea`, `select` sau într-un element
  editabil, `Backspace` își păstrează comportamentul normal și nu șterge peretele.
- `Delete` își păstrează comportamentul existent.
- La ștergerea peretelui se previne navigarea implicită a browserului asociată
  tastei `Backspace`.

## Implementare

Logica de decizie pentru taste va fi extrasă într-o funcție pură, testabilă
izolat. Handlerul global existent din `AssemblyLayout3D` va apela această funcție
și va șterge peretele selectat numai când condițiile de mai sus sunt îndeplinite.

## Testare

Testele unitare vor verifica:

- acceptarea tastei `Backspace` când există un perete selectat;
- ignorarea tastei pentru corpuri sau elemente fixe;
- ignorarea tastei când utilizatorul editează un câmp;
- păstrarea comportamentului existent pentru `Delete`.
