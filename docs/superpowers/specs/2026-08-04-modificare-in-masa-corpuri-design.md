# Modificare în masă a corpurilor dintr-un ansamblu

**Data:** 2026-08-04  
**Stare:** design aprobat

## Scop

Utilizatorul poate selecta mai multe corpuri dintr-un singur ansamblu și poate aplica, într-o singură operație, materiale noi și/sau dimensiuni exacte. Înainte de salvare, aplicația afișează impactul asupra prețului. Operația nu poate afecta alte ansambluri din proiect.

## Interfață

Lista corpurilor din fiecare card de ansamblu primește:

- o bifă pentru fiecare corp eligibil;
- o bifă „Selectează toate” limitată la ansamblul curent;
- numărul corpurilor selectate;
- butonul „Modifică în masă”, activ doar când există cel puțin o selecție.

Rândurile de tip `BLAT` nu sunt eligibile: nu au carcasă/fronturi și folosesc un formular de dimensiuni diferit. Ele nu primesc bifă și nu intră în „Selectează toate”.

Butonul deschide un dialog care păstrează vizibil contextul ansamblului. Dialogul conține câmpuri opționale pentru:

- materialul carcasei;
- configurația fronturilor;
- lățimea exactă în milimetri;
- înălțimea exactă în milimetri;
- adâncimea exactă în milimetri.

Cel puțin un câmp trebuie completat. Un câmp necompletat nu modifică valoarea existentă. Dimensiunile introduse sunt valori absolute, aplicate identic tuturor corpurilor selectate, nu diferențe față de valorile actuale.

## Alegerea materialelor

### Carcasă

Selectorul folosește materialele active compatibile cu o carcasă din catalogul existent. Actualizarea schimbă `carcassMaterialId`. Polițele generate automat folosesc materialul carcasei și se schimbă implicit odată cu aceasta.

Operația nu schimbă:

- spatele PFL;
- materialele pieselor suplimentare;
- override-urile explicite de material salvate pentru piese individuale;
- materialul blatului.

Aceste valori au propriile selecții explicite și nu trebuie suprascrise indirect.

### Fronturi și uși

Selectorul oferă întregul catalog deja disponibil în editorul unui corp:

- PAL;
- MDF melaminat;
- MDF înfoliat;
- MDF vopsit, cu furnizor, model, finisaj, număr de fețe și culoare RAL;
- sticlă cu ramă.

Payload-ul frontului este discriminat după tip. Alegerea actualizează automat `frontKind` și câmpurile asociate tipului. Câmpurile vechi incompatibile cu noul tip sunt eliminate pentru a nu influența calculul ulterior.

Modificarea frontului se aplică numai corpurilor selectate care au deja uși sau fronturi de sertar. Nu creează uși ori sertare pe corpuri care nu au fronturi. Corpurile selectate fără fronturi rămân eligibile pentru schimbarea carcasei sau a dimensiunilor și sunt raportate separat în previzualizare.

## Selecție și izolare

Clientul trimite `assemblyId`, ID-urile corpurilor selectate și patch-ul solicitat. Serverul reîncarcă ansamblul și acceptă numai ID-uri care aparțin acelui ansamblu. ID-urile străine, duplicate sau inexistente invalidează întreaga operație.

Selecția se golește după aplicarea cu succes. Închiderea sau anularea dialogului nu modifică nimic.

## Previzualizarea prețului

Înainte de confirmare, serverul execută aceeași transformare asupra unor copii în memorie ale corpurilor și recalculează oferta prin motorul existent. Previzualizarea nu scrie în baza de date.

Dialogul de confirmare afișează:

- numărul și denumirile corpurilor selectate;
- câmpurile care se vor schimba;
- corpurile fără fronturi pentru care schimbarea frontului este ignorată;
- prețul corpurilor selectate înainte și după;
- diferența pentru corpurile selectate;
- totalul ofertei înainte și după;
- diferența totală a ofertei.

Calculul folosește aceeași bază de preț ca oferta curentă: catalog live pentru proiectele ciornă și snapshot-ul înghețat pentru proiectele cu prețuri înghețate. Astfel, previzualizarea și pagina ofertei produc aceleași rezultate.

Dacă oferta nu poate fi calculată din cauza unui corp incomplet, dialogul indică explicit corpurile problematice. Nu inventează un preț și nu permite confirmarea până când patch-ul este valid.

## Validare și salvare

Serverul validează înainte de orice scriere:

- apartenența tuturor corpurilor la ansamblu;
- existența și starea activă a materialelor/configurațiilor alese;
- compatibilitatea configurației de front;
- limitele dimensionale deja acceptate de editorul individual;
- existența a cel puțin unei modificări efective.

Aplicarea folosește o singură tranzacție Prisma. Fiecare `inputJson` este normalizat, modificat strict în câmpurile cerute și serializat din nou. Dacă validarea sau actualizarea unui corp eșuează, niciun corp nu este salvat.

După succes se revalidează pagina proiectului, paginile corpurilor afectate, oferta și planul de debitare. Motorul existent recalculează materialele necesare, debitarea, canturile, manopera, prețurile corpurilor și totalul ofertei.

Pozițiile din Așezare 3D nu sunt modificate. Dimensiunile noi se reflectă în geometria corpurilor la următoarea încărcare; eventualele coliziuni de poziționare sunt responsabilitatea editorului de așezare și nu blochează operația de ofertare.

## Componente propuse

- Un control client pentru selecția rândurilor dintr-un singur ansamblu.
- Un dialog client pentru patch-ul de materiale și dimensiuni, previzualizare și confirmare.
- O funcție pură care aplică patch-ul unui `CabinetInput`; este reutilizată identic de previzualizare și salvare.
- O acțiune server fără scrieri pentru validare și calculul previzualizării.
- O acțiune server tranzacțională pentru aplicarea patch-ului.

Transformarea pură este punctul unic de definire a comportamentului. Previzualizarea și salvarea nu trebuie să implementeze separat regulile de schimbare a materialelor sau dimensiunilor.

## Tratarea erorilor

- Material dezactivat sau șters între previzualizare și confirmare: salvarea e refuzată și utilizatorul trebuie să refacă previzualizarea.
- Corp mutat în alt ansamblu între previzualizare și confirmare: întreaga operație e refuzată.
- Preț indisponibil pentru un material: se folosește comportamentul existent al ofertei și se afișează avertismentul de material fără preț.
- Eroare de tranzacție: dialogul rămâne deschis, selecția se păstrează și se afișează mesajul primit de la server.

## Testare

### Teste unitare

- patch doar de carcasă, fără modificarea spatelui, pieselor suplimentare sau override-urilor;
- polițele generate folosesc noua carcasă;
- conversii de front între PAL, MDF melaminat, MDF înfoliat, MDF vopsit și sticlă;
- eliminarea câmpurilor incompatibile la schimbarea tipului de front;
- ignorarea frontului pentru corpuri fără uși/sertare;
- aplicarea independentă a fiecărei dimensiuni și păstrarea câmpurilor necompletate;
- respingerea dimensiunilor invalide și a patch-ului gol.

### Teste de acțiuni server

- respingerea corpurilor din alt ansamblu;
- previzualizarea nu scrie în baza de date;
- salvarea actualizează toate corpurile într-o tranzacție;
- eroarea unui corp produce rollback complet;
- materialele inactive sau inexistente sunt respinse;
- prețul previzualizat corespunde calculului ofertei după salvare.

### Teste de interfață

- selectare individuală și „Selectează toate” în limitele ansamblului;
- buton dezactivat fără selecție sau fără modificări;
- afișarea câmpurilor specifice MDF vopsit și sticlei;
- afișarea prețului înainte/după și a corpurilor ignorate pentru front;
- anularea nu salvează, succesul golește selecția și actualizează totalurile.

## Criterii de acceptare

Funcționalitatea este completă când utilizatorul poate selecta orice subset de corpuri eligibile dintr-un ansamblu, poate seta împreună materiale și dimensiuni exacte opționale, poate verifica impactul financiar înainte de confirmare și poate aplica atomic modificările, iar oferta recalculată coincide cu previzualizarea.
