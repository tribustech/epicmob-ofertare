#!/usr/bin/env python3
import json, re, os, subprocess, tempfile
from collections import defaultdict

SCRATCH = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/scratchpad"
REPO = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare"
IMG_ROOT = os.path.join(REPO, "public", "decoruri")
OUT_DATA = os.path.join(REPO, "data", "decoruri-furnizori")
PRICES = os.path.join(OUT_DATA, "decoruri.json")

CATALOGS = [
    ("cat_egger.json",     "Egger",     "egger",     "Darel"),
    ("cat_kastamonu.json", "Kastamonu", "kastamonu", "Trady"),
    ("cat_agt.json",       "AGT",       "agt",       "Trady"),
]

def norm(code):
    return re.sub(r'[\s\-_./]', '', code).upper() if code else None

# ---- lookup preturi pe cod normalizat (din datasetul de dealeri) ----
price_by_code = {}
rows = json.load(open(PRICES))
for r in rows:
    n = norm(r.get("cod_decor"))
    if n and r.get("pret_ron"):
        # pastreaza primul pret gasit pt cod (variantele au preturi similare)
        price_by_code.setdefault(n, (r["pret_ron"], r["furnizor"]))

def dl(url, dest_jpg):
    """download -> valideaza -> resize 300px jpg. Returneaza (ok, motiv)."""
    if os.path.exists(dest_jpg) and os.path.getsize(dest_jpg) > 1500:
        return True, "cached"
    tmp = tempfile.mktemp(suffix=".img")
    try:
        r = subprocess.run(["curl","-sS","-L","--max-time","30","-o",tmp,"-w","%{http_code} %{size_download}",url],
                           capture_output=True, text=True, timeout=45)
        parts = r.stdout.strip().split()
        code = parts[0] if parts else "000"
        size = int(parts[1]) if len(parts)>1 else 0
        if code != "200" or size < 1500:
            return False, f"http {code} size {size} (placeholder/lipsa)"
        # resize -> jpg 300px
        rs = subprocess.run(["sips","-s","format","jpeg","-Z","300",tmp,"--out",dest_jpg],
                            capture_output=True, text=True, timeout=30)
        if rs.returncode != 0 or not os.path.exists(dest_jpg):
            return False, f"sips esec: {rs.stderr.strip()[:80]}"
        return True, "ok"
    except Exception as e:
        return False, f"exc {e}"
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)

catalog = []
stats = defaultdict(lambda: defaultdict(int))
for fname, brand, slug, price_furn in CATALOGS:
    data = json.load(open(os.path.join(SCRATCH, fname)))
    decoruri = data["decoruri"]
    outdir = os.path.join(IMG_ROOT, slug)
    os.makedirs(outdir, exist_ok=True)
    for i, d in enumerate(decoruri):
        cod = d.get("cod_decor")
        n = norm(cod)
        fnamejpg = (n or f"noimg{i}") + ".jpg"
        dest = os.path.join(outdir, fnamejpg)
        img_ok, reason = (False, "fara url")
        if d.get("image_url"):
            img_ok, reason = dl(d["image_url"], dest)
        stats[brand]["total"] += 1
        stats[brand]["img_ok" if img_ok else "img_fail"] += 1
        pret, pfurn = price_by_code.get(n, (None, None))
        if pret: stats[brand]["cu_pret"] += 1
        catalog.append({
            "brand": brand,
            "cod_decor": cod,
            "cod_normalizat": n,
            "denumire": d.get("denumire"),
            "structura": d.get("structura"),
            "image": f"/decoruri/{slug}/{fnamejpg}" if img_ok else None,
            "image_source_url": d.get("image_url"),
            "pret_ron": pret,
            "pret_furnizor": pfurn,
        })
        if (i+1) % 25 == 0:
            print(f"  [{brand}] {i+1}/{len(decoruri)}...", flush=True)

os.makedirs(OUT_DATA, exist_ok=True)
with open(os.path.join(OUT_DATA, "catalog-decoruri.json"), "w") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print("\n=== STATS ===")
for brand in stats:
    s = stats[brand]
    print(f"{brand:10} total {s['total']:3}  imagini_ok {s['img_ok']:3}  fara_imagine {s['img_fail']:3}  cu_pret {s['cu_pret']:3}")
print(f"\nTotal decoruri: {len(catalog)}")
print(f"Imagini: {IMG_ROOT}/<brand>/")
print(f"Catalog: {OUT_DATA}/catalog-decoruri.json")
