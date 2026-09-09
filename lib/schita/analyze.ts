import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { proposalSchema, type Proposal } from './schema';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MODEL = process.env.SCHITA_MODEL || 'gemini-3.6-flash';

const SYSTEM = `Ești asistentul unui atelier de mobilă la comandă din România. Primești o SCHIȚĂ desenată de mână (elevație frontală) a unei bucătării sau piese de mobilier, plus detalii text. Sarcina ta: identifici corpurile de mobilier și le întorci structurat, ca să fie generată o ofertă.

Reguli de citire:
- Cotele de pe schiță sunt de obicei în CENTIMETRI — convertește în MILIMETRI (×10).
- Rândul de sus = corpuri SUSPENDATE; rândul de jos = corpuri BAZĂ; coloanele înalte (frigider, cuptor cu coloană) = INALT.
- Roluri: chiuveta (mască chiuvetă), masina_spalat (MSV/mașină spălat vase), cuptor, frigider, cargo (Jolly = sertar îngust de sticle/ulei), blat (masca de lucru orizontală), normal (restul).
- „Jolly/cargo" este un SERTAR (drawers ≥ 1), nu ușă.
- Mască chiuvetă și mașină de spălat: fără fund.
- Corp cuptor: de obicei 1 sertar jos, nișă deschisă.
- Adâncimi tipice dacă lipsesc: bază 560, suspendate 320, coloană 560. Înălțimi: bază 820, suspendate 700.
- Adaugă un corp BLAT care acoperă lățimea corpurilor bază, dacă e bucătărie cu blat.
- Estimează doors/drawers/shelves rezonabil din desen.

Pune în „questions" orice e neclar. Detaliile text ale utilizatorului au prioritate față de schiță.

Răspunde DOAR cu JSON valid, fără text în plus, exact în forma:
{
  "reasoning": "rezumat scurt în română",
  "questions": ["intrebare 1"],
  "finishHint": "finisajul/codul de culoare scris pe schiță dacă apare, ex. „Kastamonu A669 Nuc Tramonti", altfel null",
  "clientName": null,
  "assemblyName": "Bucătărie",
  "wallWidthMm": 3100,
  "wallHeightMm": 2250,
  "cabinets": [
    {"label":"Corp chiuvetă","section":"BAZA","role":"chiuveta","widthMm":600,"heightMm":820,"depthMm":560,"doors":2,"drawers":0,"shelves":0}
  ]
}
section ∈ {BAZA,SUSPENDAT,INALT,BLAT}; role ∈ {normal,chiuveta,masina_spalat,cuptor,frigider,cargo,blat}.`;

export interface Attachment { mimeType: string; bytes: ArrayBuffer }

export async function analyzeSketch(attachments: Attachment[], details: string): Promise<Proposal> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Cheia GEMINI_API_KEY nu e setată în .env — ia una gratuită de pe aistudio.google.com și repornește serverul.');
  }
  if (attachments.length === 0) throw new Error('Încarcă cel puțin un fișier (poză sau PDF).');

  const ai = new GoogleGenAI({ apiKey });
  // Urcăm fiecare fișier prin Files API (suportă fișiere mari — inline base64 e limitat la ~20MB)
  const fileParts = [];
  for (const a of attachments) {
    let up = await ai.files.upload({ file: new Blob([a.bytes], { type: a.mimeType }), config: { mimeType: a.mimeType } });
    for (let i = 0; i < 60 && String(up.state) === 'PROCESSING'; i++) {
      await sleep(1000);
      up = await ai.files.get({ name: up.name as string });
    }
    if (String(up.state) === 'FAILED' || !up.uri) throw new Error('Un fișier nu a putut fi procesat de Gemini.');
    fileParts.push(createPartFromUri(up.uri, up.mimeType ?? a.mimeType));
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [
        ...fileParts,
        { text: `Ai primit ${attachments.length} fișier(e) (schițe/PDF-uri). Combină informația din toate.\n\nDetalii extra de la utilizator (prioritare):\n${details || '(niciun detaliu suplimentar)'}` },
      ],
    }],
    config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', temperature: 0.2 },
  });

  const text = response.text;
  if (!text) throw new Error('Modelul nu a întors niciun răspuns. Încearcă din nou sau adaugă mai multe detalii.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Răspunsul modelului nu a fost JSON valid. Încearcă din nou.');
  }
  return proposalSchema.parse(json);
}
