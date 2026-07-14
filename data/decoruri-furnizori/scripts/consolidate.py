#!/usr/bin/env python3
import json, csv, os, re

SCRATCH = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/scratchpad"
OUT_DIR = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare/data/decoruri-furnizori"
os.makedirs(OUT_DIR, exist_ok=True)

# (file, furnizor, default_brand_or_None)
SOURCES = [
    ("pal_culori_uni.json",          "Darel", "Egger"),
    ("pal_decor_lemn.json",          "Darel", "Egger"),
    ("pal_fantezie_perfectsense.json","Darel", "Egger"),
    ("mdf.json",                     "Darel", None),   # brand set per-category below
    ("trady_evogloss_agt.json",      "Trady", None),   # brand already in record
    ("trady_gizir_yildiz.json",      "Trady", None),
    ("trady_kastamonu.json",         "Trady", None),
]

def darel_mdf_brand(cat):
    return "Egger" if cat == "mdf-egger-perfect-sense" else "MDF laminat (generic)"

def parse_dims(dim):
    """Return (l, w, t) in mm from a dimension string, any order, thickness = smallest."""
    if not dim:
        return (None, None, None)
    nums = [int(x) for x in re.findall(r"\d+", dim)]
    if len(nums) < 3:
        return (None, None, None)
    nums = sorted(nums, reverse=True)
    return (nums[0], nums[1], nums[2])  # length, width, thickness

rows = []
for fname, furnizor, dbrand in SOURCES:
    with open(os.path.join(SCRATCH, fname)) as f:
        data = json.load(f)
    for r in data:
        cat = r.get("categorie")
        brand = r.get("brand") or dbrand
        if furnizor == "Darel" and fname == "mdf.json":
            brand = darel_mdf_brand(cat)
        l, w, t = parse_dims(r.get("dimensiuni"))
        grosime = r.get("grosime_mm") or t
        pret = r.get("pret_ron")
        cod = r.get("cod_decor")
        cod_norm = re.sub(r'[\s\-_.]', '', cod).upper() if cod else None
        # arie mp per foaie & pret/mp daca avem dimensiuni de placa (>=1000mm ambele)
        pret_mp = None
        if pret and l and w and l >= 1000 and w >= 1000:
            aria = (l/1000.0) * (w/1000.0)
            pret_mp = round(pret / aria, 2)
        rows.append({
            "furnizor": furnizor,
            "brand": brand,
            "cod_decor": cod,
            "cod_normalizat": cod_norm,
            "denumire": r.get("denumire"),
            "structura": r.get("structura"),
            "grosime_mm": grosime,
            "dimensiuni": r.get("dimensiuni"),
            "pret_ron": pret,
            "pret_mp_ron": pret_mp,
            "stoc": r.get("stoc"),
            "tip": r.get("tip", "produs"),
            "categorie": cat,
            "pricing_mode": "PER_SHEET",
        })

# JSON
with open(os.path.join(OUT_DIR, "decoruri.json"), "w") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

# CSV
cols = ["furnizor","brand","cod_decor","cod_normalizat","denumire","structura","grosime_mm","dimensiuni","pret_ron","pret_mp_ron","stoc","tip","categorie","pricing_mode"]
with open(os.path.join(OUT_DIR, "decoruri.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for r in rows:
        w.writerow(r)

# ---- stats ----
from collections import Counter, defaultdict
by_furnizor = Counter(r["furnizor"] for r in rows)
by_brand = Counter(r["brand"] for r in rows)
by_cat = Counter(r["categorie"] for r in rows)
produse = [r for r in rows if r["tip"] == "produs"]
cu_pret = [r for r in produse if r["pret_ron"]]

print(f"TOTAL randuri: {len(rows)}  (produse: {len(produse)}, cataloage/altele: {len(rows)-len(produse)})")
print(f"Cu pret: {len(cu_pret)} / {len(produse)} produse")
print()
print("Pe furnizor:")
for k,v in by_furnizor.most_common():
    print(f"  {k:8} {v}")
print()
print("Pe brand:")
for k,v in by_brand.most_common():
    print(f"  {str(k):26} {v}")
print()
print("Pe categorie:")
for k,v in sorted(by_cat.items()):
    print(f"  {k:32} {v}")
print()
print(f"Iesire scrisa in: {OUT_DIR}")
print("  - decoruri.json")
print("  - decoruri.csv")
