import { prisma } from '@/lib/db';
import { updateConstruction, updateSettings } from '@/lib/catalog/actions';
import { parseConstruction } from '@/lib/catalog/convert';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { ActionForm } from '@/components/ActionForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormModal } from '@/components/FormModal';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createUser, resetUserPassword, setUserActive } from '@/lib/auth/user-actions';
import { createCostCategory, setCostCategoryActive, updateCompanySettings, updateCostCategory } from '@/lib/finance/settings-actions';
import { COST_SCOPE_LABELS, QUOTE_BUCKET_LABELS } from '@/lib/finance/constants';
import { loadIndicators } from '@/lib/finance/indicators';
import { createLeadSource, renameLeadSource, setLeadSourceActive } from '@/lib/crm/lead-source-actions';
import { monthLabel } from '@/lib/finance/month';
import { fmtLei } from '@/lib/format';
import { cn } from '@/lib/utils';

const dateTimeFmt = new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const dynamic = 'force-dynamic';

const CONSTRUCTION_LABELS: Record<string, string> = {
  frontGapMm: 'Rost între fronturi (mm)',
  outerGapMm: 'Rost la marginea corpului (mm)',
  shelfSetbackMm: 'Retragere poliță (mm)',
  backRebateMm: 'Reducere spate în falț (mm)',
  boardDensityKgPerSqmPerMm: 'Densitate placă (kg/m²/mm)',
  slideClearanceMm: 'Spațiu glisieră–spate (mm)',
  palBoxSlideAllowanceMm: 'Spațiu lateral cutie sertar PAL (mm)',
  palBoxHeightDeductMm: 'Reducere înălțime cutie sertar (mm)',
  palBoxMinHeightMm: 'Înălțime minimă cutie sertar (mm)',
  tandemboxFrontClearanceMm: 'Rezervă laterală Tandembox (mm)',
  golaFrontDeductMm: 'GOLA: scurtare fronturi (mm)',
  frontExtensionDefaultMm: 'Prelungire front fără mâner (mm)',
  legsPerCabinet: 'Picioare per corp',
  shelfSpanWarnMm: 'Avertizare poliță peste (mm)',
  doorMaxWidthMm: 'Avertizare ușă peste (mm)',
  blindPanelDefaultWidthMm: 'Front fals implicit la colț (mm)',
};

export default async function SetariPage() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    return <p>Setările lipsesc — rulează <code>npm run db:seed</code>.</p>;
  }
  const construction = parseConstruction(settings.constructionJson);
  const hardware = await prisma.hardwareItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  const edgeBands = await prisma.edgeBand.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  const byCategory = (cat: string) =>
    hardware.filter((h) => h.category === cat).map((h) => ({ value: h.id, label: h.name }));
  const me = await getCurrentUser();
  const users = await prisma.user.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  const categories = await prisma.costCategory.findMany({ orderBy: [{ scope: 'asc' }, { active: 'desc' }, { sortOrder: 'asc' }] });
  const scopeOptions = Object.entries(COST_SCOPE_LABELS).map(([value, label]) => ({ value, label }));
  const bucketOptions = Object.entries(QUOTE_BUCKET_LABELS).map(([value, label]) => ({ value, label }));
  const ind = await loadIndicators();
  const leadSources = await prisma.leadSource.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }] });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Setări</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ofertare și feronerie implicită</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateSettings} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <NumberInput name="laborPct" label="Manoperă implicită (% din materiale)" defaultValue={settings.laborPct} />
              <NumberInput name="sheetYieldFactor" label="Factor utilizare foaie (doar estimarea per corp)" defaultValue={settings.sheetYieldFactor} step="0.01" />
              <NumberInput name="cutKerfMm" label="Kerf pânză (mm)" defaultValue={settings.cutKerfMm} step="0.1" />
              <NumberInput name="cutTrimMm" label="Margine curățare placă (mm)" defaultValue={settings.cutTrimMm} step="1" />
              <NumberInput name="eurToRon" label="Curs EUR→RON" defaultValue={settings.eurToRon} step="0.01" />
              <NumberInput name="profilJPerFront" label="Profil J (lei/front frezat)" defaultValue={settings.profilJPerFront} />
              <NumberInput name="golaPricePerMl" label="Profil GOLA (lei/ml)" defaultValue={settings.golaPricePerMl} />
              <NumberInput name="blatCutPricePerPiece" label="Debitare blat (lei/placă)" defaultValue={settings.blatCutPricePerPiece} />
              <NumberInput name="roundedCutPricePerPiece" label="Debitare rotund (lei/poliță)" defaultValue={settings.roundedCutPricePerPiece} />
              <NumberInput name="roundedEdgePricePerPiece" label="Cant rotund (lei/poliță)" defaultValue={settings.roundedEdgePricePerPiece} />
              <Select
                name="blatEdgeBandId" label="Cant blat (bandă)"
                options={edgeBands.map((b) => ({ value: b.id, label: b.name }))}
                defaultValue={settings.blatEdgeBandId}
                allowEmpty
              />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select name="defaultHingeId" label="Balama implicită" options={byCategory('BALAMA')} defaultValue={settings.defaultHingeId} allowEmpty />
              <Select name="defaultLegId" label="Picior implicit" options={byCategory('PICIOR')} defaultValue={settings.defaultLegId} allowEmpty />
              <Select name="defaultRailId" label="Șină implicită" options={byCategory('SINA_SUSPENDARE')} defaultValue={settings.defaultRailId} allowEmpty />
              <Select name="defaultShelfSupportId" label="Suport poliță implicit" options={byCategory('SUPORT_POLITA')} defaultValue={settings.defaultShelfSupportId} allowEmpty />
              <Select name="defaultPlinthClipId" label="Clemă soclu implicită" options={byCategory('CLEMA_SOCLU')} defaultValue={settings.defaultPlinthClipId} allowEmpty />
              <Select name="defaultAventosId" label="Set Aventos implicit" options={byCategory('PISTON_AVENTOS')} defaultValue={settings.defaultAventosId} allowEmpty />
            </div>
            <SubmitButton>Salvează setările</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Constante de construcție</CardTitle>
          <CardDescription>
            Regulile după care se generează piesele. Modifică doar dacă atelierul lucrează altfel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateConstruction} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {Object.entries(CONSTRUCTION_LABELS).map(([key, label]) => (
                <NumberInput
                  key={key} name={key} label={label}
                  defaultValue={construction[key as keyof typeof construction] as number}
                  step="0.001"
                />
              ))}
              <div className="col-span-2">
                <TextInput
                  name="slideNominalsMm"
                  label="Lungimi nominale glisiere (mm, separate prin virgulă)"
                  defaultValue={construction.slideNominalsMm.join(', ')}
                  required={false}
                />
              </div>
            </div>
            <SubmitButton>Salvează constantele</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firmă și TVA</CardTitle>
          <CardDescription>
            Datele firmei apar pe documentele către client. TVA: cât timp firma nu e plătitoare, sumele se introduc brute; la activare, documentele noi primesc split net/TVA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateCompanySettings} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <TextInput name="companyName" label="Denumire firmă" defaultValue={settings.companyName} required={false} />
              <TextInput name="companyCui" label="CUI" defaultValue={settings.companyCui} required={false} mono />
              <div className="col-span-2"><TextInput name="companyAddress" label="Adresă" defaultValue={settings.companyAddress} required={false} /></div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="vatPayer" defaultChecked={settings.vatPayer} className="size-4" />
                Plătitoare de TVA
              </label>
              <NumberInput name="vatDefaultPct" label="Cotă TVA implicită (%)" defaultValue={settings.vatDefaultPct} step="1" />
              <NumberInput name="overEstimatePct" label={'Prag „peste estimat” (%)'} defaultValue={settings.overEstimatePct} step="1" />
            </div>
            <SubmitButton>Salvează</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Categorii de cost</CardTitle>
              <CardDescription>Directe = pe proiect (apar la alocări și în Estimat vs Real). Indirecte = cheltuieli fixe ale firmei.</CardDescription>
            </div>
            <FormModal trigger="Categorie nouă" title="Categorie nouă">
              <ActionForm action={createCostCategory} className="grid gap-3">
                <TextInput name="name" label="Nume" />
                <Select name="scope" label="Tip" options={scopeOptions} defaultValue="DIRECT" />
                <Select name="quoteBucket" label="Mapare la estimat (doar directe)" options={bucketOptions} allowEmpty />
                <div><SubmitButton>Creează</SubmitButton></div>
              </ActionForm>
            </FormModal>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Mapare la estimat</TableHead>
                <TableHead>Stare</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id} className={cn(!c.active && 'text-muted-foreground')}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.scope === 'DIRECT' ? 'Directă' : 'Indirectă'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.quoteBucket ? QUOTE_BUCKET_LABELS[c.quoteBucket as keyof typeof QUOTE_BUCKET_LABELS] ?? c.quoteBucket : '—'}</TableCell>
                  <TableCell>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', c.active ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                      {c.active ? 'Activă' : 'Inactivă'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <FormModal trigger="Editează" title={`Editează „${c.name}"`} variant="outline" size="sm">
                        <ActionForm action={updateCostCategory.bind(null, c.id)} className="grid gap-3">
                          <TextInput name="name" label="Nume" defaultValue={c.name} />
                          <Select name="scope" label="Tip" options={scopeOptions} defaultValue={c.scope} />
                          <Select name="quoteBucket" label="Mapare la estimat (doar directe)" options={bucketOptions} defaultValue={c.quoteBucket} allowEmpty />
                          <div><SubmitButton>Salvează</SubmitButton></div>
                        </ActionForm>
                      </FormModal>
                      <ActionForm action={setCostCategoryActive.bind(null, c.id, !c.active)}>
                        <Button type="submit" variant="ghost" size="sm" className={cn(c.active && 'text-destructive')}>{c.active ? 'Dezactivează' : 'Activează'}</Button>
                      </ActionForm>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Surse leaduri</CardTitle>
              <CardDescription>Lista din care alegi sursa la „Lead nou". Redenumirea actualizează și clienții existenți.</CardDescription>
            </div>
            <FormModal trigger="Sursă nouă" title="Sursă nouă">
              <ActionForm action={createLeadSource} className="grid gap-3">
                <TextInput name="name" label="Nume" placeholder="TikTok" />
                <div><SubmitButton>Adaugă</SubmitButton></div>
              </ActionForm>
            </FormModal>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {leadSources.map((s) => (
              <div key={s.id} className={cn('flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-[13px]', s.active ? 'border-border bg-card' : 'border-dashed text-muted-foreground')}>
                <span className="font-medium">{s.name}</span>
                <FormModal trigger="✎" title={`Redenumește „${s.name}"`} variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground">
                  <ActionForm action={renameLeadSource.bind(null, s.id)} className="grid gap-3">
                    <TextInput name="name" label="Nume" defaultValue={s.name} />
                    <div><SubmitButton>Salvează</SubmitButton></div>
                  </ActionForm>
                </FormModal>
                <ActionForm action={setLeadSourceActive.bind(null, s.id, !s.active)}>
                  <Button type="submit" variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground" title={s.active ? 'Dezactivează' : 'Activează'}>{s.active ? '×' : '↺'}</Button>
                </ActionForm>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indicatori</CardTitle>
          <CardDescription>
            Orientativi, pe ultimele 3 luni ({ind.months.map(monthLabel).reverse().join(' · ')}). Cheltuielile indirecte nu se alocă oficial pe proiecte; ratele de mai jos sunt doar o vedere informativă.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Rată overhead</div>
              <div className="mt-1 font-mono text-2xl font-semibold">{ind.overheadRate != null ? `${Math.round(ind.overheadRate * 100)}%` : '—'}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                fixe {fmtLei(ind.fixed)} / venit recunoscut {fmtLei(ind.revenue)} · {ind.mountedProjects} {ind.mountedProjects === 1 ? 'proiect montat' : 'proiecte montate'}
                {ind.overheadRate == null && ' · fără venit recunoscut încă'}
              </div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Tarif orar încărcat</div>
              <div className="mt-1 font-mono text-2xl font-semibold">{ind.hourlyRate != null ? `${fmtLei(ind.hourlyRate)} / oră` : '—'}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                salarii + taxe {fmtLei(ind.salaries)} / {ind.hours} ore · {ind.projectsWithHours} {ind.projectsWithHours === 1 ? 'proiect cu ore' : 'proiecte cu ore'}
                {ind.hourlyRate == null && ` · se afișează de la ${ind.minProjectsForHourly} proiecte montate cu ore`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Utilizatori</CardTitle>
              <CardDescription>Toți utilizatorii sunt administratori. Parola se resetează de aici, de un alt utilizator.</CardDescription>
            </div>
            <FormModal trigger="Utilizator nou" title="Utilizator nou">
              <ActionForm action={createUser} className="grid gap-3">
                <TextInput name="name" label="Nume" />
                <TextInput name="email" label="Email" type="email" autoComplete="off" />
                <TextInput name="password" label="Parolă inițială (min. 8 caractere)" type="password" autoComplete="new-password" />
                <div><SubmitButton>Creează</SubmitButton></div>
              </ActionForm>
            </FormModal>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ultima intrare</TableHead>
                <TableHead>Stare</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className={cn(!u.active && 'text-muted-foreground')}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.id === me?.id && <span className="ml-1.5 text-[11px] text-muted-foreground">(tu)</span>}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="font-mono text-[12.5px]">{u.lastLoginAt ? dateTimeFmt.format(u.lastLoginAt) : '—'}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        u.active ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {u.active ? 'Activ' : 'Inactiv'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <FormModal trigger="Resetează parola" title={`Parolă nouă pentru ${u.name}`} variant="outline" size="sm">
                        <ActionForm action={resetUserPassword.bind(null, u.id)} className="grid gap-3">
                          <TextInput name="password" label="Parolă nouă (min. 8 caractere)" type="password" autoComplete="new-password" />
                          <div><SubmitButton>Salvează</SubmitButton></div>
                        </ActionForm>
                      </FormModal>
                      {u.active ? (
                        <ActionForm
                          action={setUserActive.bind(null, u.id, false)}
                          confirm={`Dezactivezi utilizatorul ${u.name}? Nu va mai putea intra în aplicație.`}
                        >
                          <Button type="submit" variant="ghost" size="sm" className="text-destructive">Dezactivează</Button>
                        </ActionForm>
                      ) : (
                        <ActionForm action={setUserActive.bind(null, u.id, true)}>
                          <Button type="submit" variant="ghost" size="sm">Activează</Button>
                        </ActionForm>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
