import { prisma } from '@/lib/db';
import { updateConstruction, updateSettings } from '@/lib/catalog/actions';
import { parseConstruction } from '@/lib/catalog/convert';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { ActionForm } from '@/components/ActionForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
  blindPanelDefaultWidthMm: 'Lățime implicită panou orb (mm)',
};

export default async function SetariPage() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    return <p>Setările lipsesc — rulează <code>npm run db:seed</code>.</p>;
  }
  const construction = parseConstruction(settings.constructionJson);
  const hardware = await prisma.hardwareItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  const byCategory = (cat: string) =>
    hardware.filter((h) => h.category === cat).map((h) => ({ value: h.id, label: h.name }));

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
    </div>
  );
}
