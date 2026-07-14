#!/usr/bin/env python3
import json, os, re, subprocess, tempfile

REPO = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare"
CAT = os.path.join(REPO, "data", "decoruri-furnizori", "catalog-decoruri.json")
IMGROOT = os.path.join(REPO, "public", "decoruri", "blaturi")
TASKS = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/tasks"
RAW = os.path.join(REPO, "data", "decoruri-furnizori", "raw")

def norm(c): return re.sub(r'[\s\-_./]', '', c).upper() if c else None
def struct(c):
    if not c: return None
    m = re.search(r'\b((?:ST|TS|PS|PM|PA|PG|G)\d*)\b', c.upper())
    return m.group(1) if m else None
def width_of(dim):
    if not dim: return None
    nums = re.findall(r'\d+', dim)
    return int(nums[1]) if len(nums) >= 3 else None

def texts_of(task_id):
    path=os.path.join(TASKS,f"{task_id}.output"); out=[]
    with open(path,errors="ignore") as f:
        for line in f:
            line=line.strip()
            if not line: continue
            try: obj=json.loads(line)
            except: continue
            st=[obj]
            while st:
                cur=st.pop()
                if isinstance(cur,dict):
                    for k,v in cur.items():
                        if k=="text" and isinstance(v,str): out.append(v)
                        else: st.append(v)
                elif isinstance(cur,list): st.extend(cur)
    return out
def find_json(texts, needle):
    for t in texts:
        if needle in t:
            m=re.search(r'(\{.*\})', t, re.S)
            if m:
                try: return json.loads(m.group(1))
                except: pass
    return None

darel = find_json(texts_of("a2f8160c6d826edab"), '"blaturi"')
trady = find_json(texts_of("afa73bb8f9f065e27"), '"template_id"')
json.dump(darel, open(os.path.join(RAW,"blaturi_egger_darel.json"),"w"), ensure_ascii=False, indent=1)
json.dump(trady, open(os.path.join(RAW,"blaturi_kastamonu_trady.json"),"w"), ensure_ascii=False, indent=1)
print(f"Darel blaturi: {len(darel['blaturi'])}  Trady blaturi: {len(trady['produse'])}")

def dl(url, dest):
    tmp=tempfile.mktemp(suffix=".img")
    try:
        r=subprocess.run(["curl","-sS","-L","--max-time","30","-o",tmp,"-w","%{http_code} %{size_download}",url],
                         capture_output=True,text=True,timeout=45)
        p=r.stdout.strip().split()
        if not p or p[0]!="200" or int(p[1])<900: return False
        rs=subprocess.run(["sips","-s","format","jpeg","-Z","300",tmp,"--out",dest],
                         capture_output=True,text=True,timeout=30)
        return rs.returncode==0 and os.path.exists(dest)
    except Exception: return False
    finally:
        if os.path.exists(tmp): os.remove(tmp)

catalog = json.load(open(CAT))
# marcheaza randurile existente ca placa
for r in catalog:
    r.setdefault("tip", "placa")

def add(brand, slug, rec, image_url, tip, categorie):
    cod=rec.get("cod_decor"); n=norm(cod)
    g=rec.get("grosime_mm"); dim=rec.get("dimensiuni"); w=width_of(dim)
    key=f"{n}_{w}_{g}"
    outdir=os.path.join(IMGROOT, slug); os.makedirs(outdir, exist_ok=True)
    dest=os.path.join(outdir, f"{key}.jpg")
    img = f"/decoruri/blaturi/{slug}/{key}.jpg" if (image_url and dl(image_url,dest)) else None
    catalog.append({
        "brand":brand, "cod_decor":cod, "cod_normalizat":n,
        "denumire":rec.get("denumire"), "structura":struct(cod),
        "dimensiuni":dim, "grosime_mm":g, "latime_mm":w,
        "image":img, "image_source_url":image_url,
        "pret_ron":rec.get("pret_ron"), "pret_furnizor":("Darel" if brand=="Egger" else "Trady") if rec.get("pret_ron") else None,
        "tip":tip, "categorie":categorie,
    })
    return bool(img)

nd=ni=0
for b in darel["blaturi"]:
    ok=add("Egger","egger", b, b.get("image_url"), "blat", b.get("categorie","blat-egger"))
    nd+=1; ni+= 1 if ok else 0
nt=nti=0
for p in trady["produse"]:
    tid=p.get("template_id")
    url=f"https://trady.ro/web/image/product.template/{tid}/image_1024" if tid else None
    ok=add("Kastamonu","kastamonu", p, url, p.get("tip","blat"), "blat-kastamonu")
    nt+=1; nti+= 1 if ok else 0

json.dump(catalog, open(CAT,"w"), ensure_ascii=False, indent=2)
bl=[r for r in catalog if r.get("tip") in ("blat","panou_spate")]
print(f"Blaturi adaugate: Egger {nd} (imagini {ni}), Kastamonu {nt} (imagini {nti})")
print(f"Total blaturi in catalog: {len(bl)}  cu imagine {sum(1 for r in bl if r['image'])}  cu pret {sum(1 for r in bl if r['pret_ron'])}")
print(f"Total catalog: {len(catalog)}")
