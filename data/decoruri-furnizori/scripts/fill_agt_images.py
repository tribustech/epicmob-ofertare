#!/usr/bin/env python3
import json, os, re, subprocess, tempfile

REPO = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare"
CAT = os.path.join(REPO, "data", "decoruri-furnizori", "catalog-decoruri.json")
IMGDIR = os.path.join(REPO, "public", "decoruri", "agt")
SC = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/scratchpad"
os.makedirs(IMGDIR, exist_ok=True)

ids = json.load(open(os.path.join(SC, "agt_ids.json")))
idmap = {i["cod_numeric"]: i["template_id"] for i in ids}
catalog = json.load(open(CAT))

def numof(cod):
    if not cod: return None
    m = re.search(r'\d+', cod)
    return m.group(0) if m else None

def dl(url, dest):
    tmp = tempfile.mktemp(suffix=".img")
    try:
        r = subprocess.run(["curl","-sS","-L","--max-time","30","-o",tmp,"-w","%{http_code} %{size_download}",url],
                           capture_output=True, text=True, timeout=45)
        p = r.stdout.strip().split()
        if not p or p[0] != "200" or int(p[1]) < 900:
            return False
        rs = subprocess.run(["sips","-s","format","jpeg","-Z","300",tmp,"--out",dest],
                            capture_output=True, text=True, timeout=30)
        return rs.returncode == 0 and os.path.exists(dest)
    except Exception:
        return False
    finally:
        if os.path.exists(tmp): os.remove(tmp)

filled = 0
for row in catalog:
    if row["brand"] != "AGT":
        continue
    num = numof(row.get("cod_decor"))
    # normalizeaza cheia AGT la numeric (consistenta), pastrand L-series
    if row.get("cod_decor","").upper().startswith("L") and re.match(r'^L\d', row["cod_decor"].upper()):
        pass  # L172 ramane
    elif num:
        row["cod_normalizat"] = num
    if row.get("image"):
        continue
    tid = idmap.get(num)
    if not tid:
        continue
    dest = os.path.join(IMGDIR, f"{num}.jpg")
    url = f"https://trady.ro/web/image/product.template/{tid}/image_1024"
    if dl(url, dest):
        row["image"] = f"/decoruri/agt/{num}.jpg"
        row["image_source_url"] = url
        filled += 1

json.dump(catalog, open(CAT, "w"), ensure_ascii=False, indent=2)
agt = [r for r in catalog if r["brand"]=="AGT"]
print(f"AGT poze completate din Trady: {filled}")
print(f"AGT total {len(agt)}  cu imagine {sum(1 for r in agt if r['image'])}  cu pret {sum(1 for r in agt if r['pret_ron'])}")
