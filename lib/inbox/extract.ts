/**
 * Citirea unui bon / unei facturi cu Gemini (același furnizor ca „Schiță → Ofertă").
 * Primește pozele/PDF-urile + textul colegului și listele de proiecte/categorii, ca să poată și sugera
 * unde merge cheltuiala. Omul confirmă mereu în bot, iar Alesia validează în aplicație.
 */
import { GoogleGenAI } from '@google/genai';
import { receiptSchema, type Receipt } from './receipt';

const MODEL = process.env.RECEIPT_MODEL || process.env.SCHITA_MODEL || 'gemini-3.6-flash';

const SYSTEM = `Ești asistentul financiar al unui atelier de mobilă la comandă din România. Colegii îți trimit poze cu bonuri fiscale, facturi, chitanțe sau doar un mesaj text despre o plată (de multe ori cash, fără document). Extragi datele și sugerezi proiectul și categoria.

Reguli:
- total = suma TOTALĂ de plată, cu TVA inclus, în lei. Pe bonuri e la „TOTAL"; nu confunda cu „REST" sau „NUMERAR" primit.
- issuedAt = data documentului, format YYYY-MM-DD. Dacă e doar text fără dată, lasă null.
- kind: FACTURA (factură), BON (bon fiscal), CHITANTA (chitanță), ALTUL (doar text, ciornă, altceva).
- paymentHint: CASH dacă pe bon apare NUMERAR sau colegul spune cash; CARD dacă apare CARD; TRANSFER pentru facturi cu plată ulterioară (OP); altfel NECUNOSCUT.
- vatPct: cota TVA dominantă (de obicei 21), sau null.
- summary: ce s-a cumpărat, max 80 de caractere, în română (ex. „șuruburi, silicon, discuri flex").
- projectId: DOAR un id din lista de proiecte primită, dacă textul colegului sau documentul (adresa de livrare, numele clientului) îl indică clar. Altfel null — nu ghici. Dacă textul spune „stoc", „pentru atelier", „să avem": null.
- categoryName: EXACT unul din numele de categorii primite, cel mai potrivit (ex. Feronerie, Plăci, Transport, Combustibil, Unelte/consumabile).
- items: produsele de pe document, max 30, fiecare cu totalul liniei în lei (cu TVA). Pentru mesaje doar text: [].
- split: DOAR dacă colegul spune explicit în text că bonul se împarte (pe proiecte și/sau stoc). Fiecare rând are project = id din listă sau "STOC" (cumpărat pentru atelier, nu pentru un proiect) și amount = suma în lei, sau null pentru „restul". Folosește items ca să calculezi sumele (ex. „balamalele sunt pentru stoc, restul Popescu" → STOC cu suma liniilor de balamale, proiectul Popescu cu null). Dacă nu se cere împărțire: [].
- notes: orice e neclar (poză neclară, sume care nu se leagă), altfel null.
- Textul colegului are prioritate față de ce citești în poză.

Răspunde DOAR cu JSON valid, exact în forma:
{"kind":"BON","counterparty":"Dedeman","counterpartyCui":"RO2816464","number":"0123","issuedAt":"2026-10-14","total":1234.5,"currency":"RON","vatPct":21,"paymentHint":"CARD","summary":"…","projectId":null,"categoryName":"Feronerie","notes":null,"items":[{"name":"Balama Blum Clip Top x20","total":480}],"split":[]}`;

export interface ReceiptFile { mimeType: string; bytes: Uint8Array }

export async function extractReceipt(input: {
  files: ReceiptFile[];
  text: string | null;
  senderName: string | null;
  projects: { id: string; label: string }[];
  categories: { name: string; scope: string }[];
  today: Date;
}): Promise<Receipt> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY nu e setată.');
  const ai = new GoogleGenAI({ apiKey });

  const context = [
    `Data de azi: ${input.today.toISOString().slice(0, 10)}.`,
    input.senderName ? `Trimis de: ${input.senderName}.` : '',
    `Mesajul colegului: ${input.text?.trim() || '(fără text)'}`,
    `Proiecte active (id — nume · client):\n${input.projects.map((p) => `${p.id} — ${p.label}`).join('\n') || '(niciunul)'}`,
    `Categorii: ${input.categories.map((c) => `${c.name} (${c.scope === 'DIRECT' ? 'pe proiect' : 'firmă'})`).join(', ')}`,
    input.files.length ? `Ai ${input.files.length} fișier(e) atașat(e); pot fi pagini ale aceluiași document.` : 'Nu e niciun fișier — doar mesajul text.',
  ].filter(Boolean).join('\n\n');

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [
        // bonurile sunt mici (sub limita de ~20MB pentru inline), deci nu trecem prin Files API
        ...input.files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: Buffer.from(f.bytes).toString('base64') } })),
        { text: context },
      ],
    }],
    config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', temperature: 0.1 },
  });

  const text = response.text;
  if (!text) throw new Error('Modelul nu a întors niciun răspuns.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Răspunsul modelului nu a fost JSON valid.');
  }
  return receiptSchema.parse(json);
}
