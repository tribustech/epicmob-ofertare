#!/usr/bin/env python3
import json, os, re, subprocess, tempfile

REPO = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare"
CAT = os.path.join(REPO, "data", "decoruri-furnizori", "catalog-decoruri.json")
IMGDIR = os.path.join(REPO, "public", "decoruri", "egger")
TASKS = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/tasks"
RAW = os.path.join(REPO, "data", "decoruri-furnizori", "raw")
os.makedirs(IMGDIR, exist_ok=True)

def norm(c): return re.sub(r'[\s\-_./]', '', c).upper() if c else None

# extrage blocul JSON din transcriptul agentului Egger-Darel
def extract(task_id):
    path = os.path.join(TASKS, f"{task_id}.output")
    texts=[]
    with open(path, errors="ignore") as f:
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
                        if k=="text" and isinstance(v,str): texts.append(v)
                        else: st.append(v)
                elif isinstance(cur,list): st.extend(cur)
    for t in texts:
        if '"decoruri"' in t and 'darel.ro' in t:
            m=re.search(r'(\{.*"decoruri".*\})', t, re.S)
            if m:
                try: return json.loads(m.group(1))
                except:
                    i,j=t.find('{'),t.rfind('}')
                    try: return json.loads(t[i:j+1])
                    except: pass
    return None

data = extract("a0c6dda120a06b58c")
decoruri = data["decoruri"] if data else []
# salveaza brut
json.dump(data, open(os.path.join(RAW, "egger_darel_images.json"),"w"), ensure_ascii=False, indent=1)
imgmap = {}
for d in decoruri:
    if d.get("image_url"):
        imgmap.setdefault(norm(d["cod_decor"]), d["image_url"])
print(f"Egger imagini darel gasite: {len(imgmap)}")

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

catalog=json.load(open(CAT))
filled=0
for row in catalog:
    if row["brand"]!="Egger" or row.get("image"): continue
    url=imgmap.get(row["cod_normalizat"])
    if not url: continue
    dest=os.path.join(IMGDIR, f"{row['cod_normalizat']}.jpg")
    if dl(url,dest):
        row["image"]=f"/decoruri/egger/{row['cod_normalizat']}.jpg"
        row["image_source_url"]=url
        filled+=1

json.dump(catalog, open(CAT,"w"), ensure_ascii=False, indent=2)
e=[r for r in catalog if r["brand"]=="Egger"]
print(f"Egger poze completate: {filled}")
print(f"Egger total {len(e)}  cu imagine {sum(1 for r in e if r['image'])}  cu pret {sum(1 for r in e if r['pret_ron'])}")
