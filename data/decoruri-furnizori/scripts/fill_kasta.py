#!/usr/bin/env python3
import json, os, re, subprocess, tempfile

REPO = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare"
CAT = os.path.join(REPO, "data", "decoruri-furnizori", "catalog-decoruri.json")
IMGDIR = os.path.join(REPO, "public", "decoruri", "kastamonu")
SC = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/scratchpad"
os.makedirs(IMGDIR, exist_ok=True)

def norm(c): return re.sub(r'[\s\-_./]', '', c).upper() if c else None
def struct(c):
    m = re.search(r'PS\d+', c.upper()) if c else None
    return m.group(0) if m else None

ids = json.load(open(os.path.join(SC, "kasta_ids.json")))["produse"]
idmap = {}
for i in ids:
    idmap.setdefault(norm(i["cod"]), (i["cod"], i["template_id"]))

# denumire + pret din datele Trady Kastamonu (145 randuri)
trady = json.load(open(os.path.join(SC, "trady_kastamonu.json")))
tinfo = {}
for t in trady:
    tinfo.setdefault(norm(t["cod_decor"]), (t["denumire"], t.get("pret_ron")))

catalog = json.load(open(CAT))

def dl(tid, dest):
    url = f"https://trady.ro/web/image/product.template/{tid}/image_1024"
    tmp = tempfile.mktemp(suffix=".img")
    try:
        r = subprocess.run(["curl","-sS","-L","--max-time","30","-o",tmp,"-w","%{http_code} %{size_download}",url],
                           capture_output=True, text=True, timeout=45)
        p = r.stdout.strip().split()
        if not p or p[0] != "200" or int(p[1]) < 900: return None
        rs = subprocess.run(["sips","-s","format","jpeg","-Z","300",tmp,"--out",dest],
                            capture_output=True, text=True, timeout=30)
        return url if (rs.returncode==0 and os.path.exists(dest)) else None
    except Exception:
        return None
    finally:
        if os.path.exists(tmp): os.remove(tmp)

present = set()
filled = 0
for row in catalog:
    if row["brand"] != "Kastamonu": continue
    present.add(row["cod_normalizat"])
    if row.get("image"): continue
    ent = idmap.get(row["cod_normalizat"])
    if not ent: continue
    dest = os.path.join(IMGDIR, f"{row['cod_normalizat']}.jpg")
    u = dl(ent[1], dest)
    if u:
        row["image"] = f"/decoruri/kastamonu/{row['cod_normalizat']}.jpg"
        row["image_source_url"] = u
        filled += 1

added = 0
for ncode, (cod, tid) in idmap.items():
    if ncode in present: continue
    present.add(ncode)
    den, pret = tinfo.get(ncode, (cod, None))
    dest = os.path.join(IMGDIR, f"{ncode}.jpg")
    u = dl(tid, dest)
    catalog.append({
        "brand": "Kastamonu",
        "cod_decor": cod,
        "cod_normalizat": ncode,
        "denumire": den,
        "structura": struct(cod),
        "image": f"/decoruri/kastamonu/{ncode}.jpg" if u else None,
        "image_source_url": u,
        "pret_ron": pret,
        "pret_furnizor": "Trady" if pret else None,
    })
    added += 1

json.dump(catalog, open(CAT, "w"), ensure_ascii=False, indent=2)
k = [r for r in catalog if r["brand"]=="Kastamonu"]
print(f"Kastamonu: poze completate {filled}, randuri adaugate {added}")
print(f"Kastamonu total {len(k)}  cu imagine {sum(1 for r in k if r['image'])}  cu pret {sum(1 for r in k if r['pret_ron'])}")
