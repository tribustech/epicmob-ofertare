# Auth — login local cu JWT, utilizatori

**Data:** 2026-09-10
**Context:** aplicația e publică pe Vercel fără niciun login. E primul sub-proiect din designul umbrelă CRM (`new features/2026-09-10-crm-design.md`, §9.1). Toate entitățile CRM ulterioare au `createdById → User`, deci `User` trebuie să existe înaintea lor.

**Abordare aleasă:** implementare proprie, fără NextAuth. Email + parolă, JWT semnat (HS256) în cookie httpOnly, verificat în `middleware.ts` (Edge) cu `jose`. Fără roluri: toți utilizatorii sunt admin. Login-ul există pentru securitate și pentru semnarea acțiunilor în timeline.

## Decizii

- **Sesiune:** 30 de zile, reînnoită la fiecare request autentificat (cookie re-emis dacă a trecut > 1 zi de la emitere).
- **Primul utilizator:** script `npm run db:create-user -- <email> "<nume>" <parolă>`, rulat de dezvoltator pe baza de producție. Fără variabile de mediu pentru admin.
- **Brute force:** întârziere fixă de 500 ms la orice eșec de login. Fără blocare de cont.
- **Reset parolă:** doar din Setări → Utilizatori, de alt admin. Fără email.
- **Dezactivare:** `active=false` → login refuzat; sesiunile existente pică la următorul request (middleware verifică doar JWT-ul, dar `getCurrentUser()` din server components/actions verifică `active` în DB; un user inactiv e redirecționat la `/login`).
- **Utilizatorul nu se poate dezactiva pe sine** și nu poate fi dezactivat ultimul utilizator activ.

## Pași atomici (fiecare = PR merge-uibil, aplicația rămâne funcțională)

### A1. Model `User` + migrare + script

```
model User {
  id           String   @id @default(cuid())
  email        String   @unique       // stocat lowercase + trim
  name         String
  passwordHash String
  active       Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- `prisma migrate dev --name add_user`.
- `scripts/create-user.ts` + script npm `db:create-user`. Idempotent pe email: dacă există, actualizează parola și numele (util și ca reset de urgență).
- Dependențe: `bcryptjs` (+ `@types/bcryptjs`), `jose`.

### A2. `lib/auth/`

- `password.ts`: `hashPassword`, `verifyPassword` (bcrypt cost 10).
- `jwt.ts`: `signSession({ userId })` / `verifySession(token)` cu `jose` (HS256, secret din `AUTH_SECRET`, `exp` 30 zile, `iat`). Fără dependențe de Node, ca să meargă și în middleware.
- `cookie.ts`: nume `epicmob_session`, `httpOnly`, `sameSite=lax`, `secure` în producție, `path=/`, `maxAge` 30 zile.
- `current-user.ts`: `getCurrentUser()` (server-only) — citește cookie-ul, verifică JWT-ul, încarcă userul din DB, întoarce `null` dacă lipsește sau e inactiv. `requireUser()` → redirect la `/login` când e `null`. Folosit de server actions ca să semneze `createdById`.
- `.env.example`: `AUTH_SECRET=` cu notă „min. 32 de caractere, `openssl rand -base64 32`".

### A3. `/login` + acțiuni + middleware

- `app/login/page.tsx`: card centrat (max-w 380px), logo „EpicMob", `TextInput` email + parolă, buton „Intră". Eroare inline „Email sau parolă greșită." (același mesaj pentru orice cauză, inclusiv user inactiv). Fără „creează cont", fără „am uitat parola".
- `app/login/layout.tsx`: layout fără header/nav (pagina de login nu arată navigația).
- `lib/auth/actions.ts`: `login(formData)` (validare zod, lookup email lowercase, verify, 500 ms delay la eșec, set cookie, `lastLoginAt`, redirect la `?next=` sau `/`) și `logout()` (șterge cookie, redirect `/login`).
- `middleware.ts` la rădăcină: verifică cookie-ul pe orice rută în afară de `/login`, `/_next/*`, `/favicon.ico`, fișierele din `public/`. Fără token valid → redirect `/login?next=<pathname>`. Cu token valid pe `/login` → redirect `/`. Reînnoire cookie dacă `iat` e mai vechi de o zi.
- Server actions sunt POST-uri pe rutele paginilor, deci middleware-ul le acoperă. Nu există `app/api/*` de protejat separat.
- **Deploy imediat** după A3: se rulează A1 pe producție (creare user), se setează `AUTH_SECRET` în Vercel, se publică.

### A4. Header

- În `app/layout.tsx`, dreapta nav-ului: numele userului (13px, muted) + buton „Ieși" (`ActionForm action={logout}`, ghost). Layout-ul e server component, deci apelează `getCurrentUser()` direct; dacă e `null` (nu ar trebui, middleware-ul blochează) nu afișează nimic.

### A5. Setări → Utilizatori

- Pagina `/setari` primește o secțiune nouă (card) „Utilizatori" sub setările existente. Nu introducem tab-uri acum; tab-urile vin cu sub-proiectele următoare (Firmă și TVA, Categorii de cost etc.).
- Tabel: nume, email, ultima intrare, stare (pill Activ / Inactiv), acțiuni: „Resetează parola" (panou inline cu parolă nouă), „Dezactivează" / „Activează".
- Formular „Utilizator nou": nume, email, parolă inițială. Validare: email unic (mesaj clar), parolă ≥ 8 caractere.
- Acțiuni în `lib/auth/user-actions.ts`: `createUser`, `setUserActive`, `resetUserPassword`. Toate cer `requireUser()`. Regulile din Decizii (nu te dezactivezi pe tine, nu ultimul activ).

## Ce NU se schimbă

Motorul de ofertare, schema existentă (doar se adaugă `User`), rutele existente, stilul vizual. Nicio entitate existentă nu primește `createdById` acum — vine cu CRM-ul.

## Verificare (gate: tsc + build + smoke)

1. `npx tsc --noEmit`, `npm run build`, `npm test`.
2. Smoke: fără cookie orice rută → `/login?next=...`; login greșit → mesaj inline, ~500 ms; login corect → redirect la `next`; „Ieși" → `/login`; user dezactivat → următorul request îl scoate; Setări: creare user, reset parolă, dezactivare, refuz la auto-dezactivare și la ultimul activ.
3. Teste unitare mici pentru `jwt.ts` (sign/verify/expirare) și `password.ts`.

## Riscuri / decizii

- **Secretul JWT lipsă în producție** → aplicația trebuie să refuze să pornească (throw la import în `jwt.ts` dacă `AUTH_SECRET` < 32 caractere), nu să ruleze nesecurizată.
- **Middleware pe Edge** → doar `jose`, fără Prisma în middleware. Verificarea `active` se face în `getCurrentUser()`, nu în middleware; fereastra de până la un request pentru un user dezactivat e acceptată.
- **Fără rate limiting real** → acceptat pentru 2-3 utilizatori; se poate adăuga ulterior.
