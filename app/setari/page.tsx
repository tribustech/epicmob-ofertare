import { prisma } from '@/lib/db';
import { updateConstruction, updateSettings } from '@/lib/catalog/actions';
import { parseConstruction } from '@/lib/catalog/convert';
import { NumberInput, Select, SubmitButton } from '@/components/forms';

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
  metalBoxBottomDeductMm: 'Reducere fund sertar metalic (mm)',
  metalBoxBackHeightMm: 'Înălțime spate sertar metalic (mm)',
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
      <h1 className="text-xl font-bold">Setări</h1>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Ofertare și feronerie implicită</h2>
        <form action={updateSettings} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput name="markupPct" label="Adaos implicit (%)" defaultValue={settings.markupPct} />
            <NumberInput name="sheetYieldFactor" label="Factor utilizare foaie (0–1)" defaultValue={settings.sheetYieldFactor} step="0.01" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Select name="defaultHingeId" label="Balama implicită" options={byCategory('BALAMA')} defaultValue={settings.defaultHingeId} allowEmpty />
            <Select name="defaultHandleId" label="Mâner implicit" options={byCategory('MANER')} defaultValue={settings.defaultHandleId} allowEmpty />
            <Select name="defaultLegId" label="Picior implicit" options={byCategory('PICIOR')} defaultValue={settings.defaultLegId} allowEmpty />
            <Select name="defaultRailId" label="Șină implicită" options={byCategory('SINA_SUSPENDARE')} defaultValue={settings.defaultRailId} allowEmpty />
          </div>
          <SubmitButton>Salvează setările</SubmitButton>
        </form>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Constante de construcție</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Regulile după care se generează piesele. Modifică doar dacă atelierul lucrează altfel.
        </p>
        <form action={updateConstruction} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(CONSTRUCTION_LABELS).map(([key, label]) => (
              <NumberInput
                key={key} name={key} label={label}
                defaultValue={construction[key as keyof typeof construction] as number}
                step="0.001"
              />
            ))}
            <label className="col-span-2 block text-sm">
              <span className="text-neutral-600">Lungimi nominale glisiere (mm, separate prin virgulă)</span>
              <input
                type="text" name="slideNominalsMm"
                defaultValue={construction.slideNominalsMm.join(', ')}
                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <SubmitButton>Salvează constantele</SubmitButton>
        </form>
      </section>
    </div>
  );
}
