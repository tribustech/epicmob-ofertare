#!/usr/bin/env python3
import json, os, re

REPO = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare"
OUT = os.path.join(REPO, "data", "decoruri-furnizori", "catalog-decoruri.json")
SC = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/scratchpad"

catalog = json.load(open(OUT))
trady = json.load(open(os.path.join(SC, "trady_agt_coduri.json")))

# map cod_numeric -> record trady
tmap = {t["cod_numeric"]: t for t in trady}

def infer_struct(den):
    d = den.lower()
    if "supramat" in d: return "supramat"
    if "riflaj" in d: return "riflaj"
    if d.startswith("hg") or "gloss" in d: return "high gloss"
    if "soft" in d: return "supermat"
    if "mat" in d: return "mat"
    return None

updated = 0
present = set()
for row in catalog:
    if row["brand"] != "AGT":
        continue
    present.add(row["cod_normalizat"])
    t = tmap.get(row["cod_normalizat"])
    if t and t.get("pret_ron"):
        row["pret_ron"] = t["pret_ron"]
        row["pret_furnizor"] = "Trady"
        updated += 1

# adauga codurile AGT de la Trady care nu-s deja in catalog
added = 0
for t in trady:
    n = t["cod_numeric"]
    if n in present:
        continue
    present.add(n)
    catalog.append({
        "brand": "AGT",
        "cod_decor": t["cod"],
        "cod_normalizat": n,
        "denumire": t["denumire"],
        "structura": infer_struct(t["denumire"]),
        "image": None,
        "image_source_url": None,
        "pret_ron": t.get("pret_ron"),
        "pret_furnizor": "Trady" if t.get("pret_ron") else None,
    })
    added += 1

json.dump(catalog, open(OUT, "w"), ensure_ascii=False, indent=2)

agt = [r for r in catalog if r["brand"]=="AGT"]
print(f"AGT existente cu pret setat din Trady: {updated}")
print(f"AGT adaugate din Trady (cod nou): {added}")
print(f"AGT total acum: {len(agt)}  cu pret: {sum(1 for r in agt if r['pret_ron'])}  cu imagine: {sum(1 for r in agt if r['image'])}")
print(f"Catalog total acum: {len(catalog)}")
