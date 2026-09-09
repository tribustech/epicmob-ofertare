'use server';

import { revalidatePath } from 'next/cache';
import { analyzeSketch } from './analyze';
import { proposalSchema, type Proposal } from './schema';
import { createProjectFromProposal, resolveBuildIds, type FrontVariant } from './build';

export type AnalyzeResult = { ok: true; proposal: Proposal } | { ok: false; error: string };

function guessMime(name: string, type: string): string {
  if (type) return type;
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.heic')) return 'image/heic';
  return 'application/octet-stream';
}

export async function analyzeSketchAction(fd: FormData): Promise<AnalyzeResult> {
  try {
    const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, error: 'Încarcă cel puțin un fișier (poză sau PDF).' };

    const attachments: { mimeType: string; bytes: ArrayBuffer }[] = [];
    let extraText = '';
    let total = 0;
    for (const f of files) {
      total += f.size;
      if (total > 45 * 1024 * 1024) return { ok: false, error: 'Fișierele depășesc 45MB în total.' };
      const mime = guessMime(f.name, f.type);
      const ab = await f.arrayBuffer();
      if (mime.startsWith('text/') || /\.(txt|md|csv)$/i.test(f.name)) {
        extraText += `\n\n[${f.name}]\n${Buffer.from(ab).toString('utf8').slice(0, 20000)}`;
      } else {
        attachments.push({ mimeType: mime, bytes: ab });
      }
    }
    if (attachments.length === 0) return { ok: false, error: 'Încarcă cel puțin o poză sau un PDF (nu doar text).' };

    const details = String(fd.get('details') ?? '') + extraText;
    const proposal = await analyzeSketch(attachments, details);
    return { ok: true, proposal };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Eroare la analiza schiței.' };
  }
}

export type CreateResult =
  | { ok: true; projects: { id: string; name: string; variant: FrontVariant }[] }
  | { ok: false; error: string };

export interface CreateOpts {
  clientName: string;
  variants: FrontVariant[];
  addSoclu: boolean;
  cargoLine: boolean;
  carcassMaterialId?: string;
  frontPalMaterialId?: string;
  blatMaterialId?: string;
  vopsitRal?: string;
  vopsitFinish?: 'MAT' | 'LUCIOS';
}

export async function createFromProposalAction(rawProposal: unknown, opts: CreateOpts): Promise<CreateResult> {
  try {
    const proposal = proposalSchema.parse(rawProposal);
    const variants = opts.variants.filter((v) => v === 'vopsit' || v === 'pal');
    if (variants.length === 0) return { ok: false, error: 'Alege cel puțin o variantă (vopsit / PAL).' };
    const ids = await resolveBuildIds();
    const projects: { id: string; name: string; variant: FrontVariant }[] = [];
    for (const variant of variants) {
      const id = await createProjectFromProposal(proposal, {
        clientName: opts.clientName, front: variant, addSoclu: opts.addSoclu, cargoLine: opts.cargoLine,
        carcassMaterialId: opts.carcassMaterialId, frontPalMaterialId: opts.frontPalMaterialId,
        blatMaterialId: opts.blatMaterialId, vopsitRal: opts.vopsitRal, vopsitFinish: opts.vopsitFinish,
      }, ids);
      projects.push({ id, name: `${proposal.assemblyName} — ${variant === 'vopsit' ? 'MDF vopsit' : 'PAL'}`, variant });
    }
    revalidatePath('/proiecte');
    return { ok: true, projects };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Eroare la crearea proiectului.' };
  }
}
