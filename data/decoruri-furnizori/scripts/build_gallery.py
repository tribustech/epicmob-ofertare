#!/usr/bin/env python3
import json, os, html

REPO = "/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare"
OUT_DATA = os.path.join(REPO, "data", "decoruri-furnizori")
catalog = json.load(open(os.path.join(OUT_DATA, "catalog-decoruri.json")))
GAL = os.path.join(REPO, "public", "decoruri", "galerie.html")

def rel_img(p):
    return p.replace("/decoruri/", "") if p else None

def tip_label(t):
    return {"blat":"blat","panou_spate":"panou spate"}.get(t, "placă")

cards = []
for d in catalog:
    img = rel_img(d.get("image"))
    pret = d.get("pret_ron")
    pret_txt = f'{pret:.2f} lei' if pret else '—'
    pfurn = d.get("pret_furnizor") or ''
    tip = d.get("tip", "placa")
    thumb = (f'<img loading="lazy" src="{html.escape(img)}" alt="">' if img
             else '<div class="noimg">fără imagine</div>')
    dims = d.get("dimensiuni") or ''
    dim_html = f'<div class="dim">{html.escape(dims)}</div>' if dims and tip!="placa" else ''
    tipbadge = f'<span class="tip t-{tip}">{tip_label(tip)}</span>' if tip!="placa" else ''
    search = (str(d.get('cod_decor') or '')+' '+str(d.get('denumire') or '')+' '+d['brand']+' '+tip_label(tip)).lower()
    cards.append(f'''<div class="card" data-brand="{d['brand']}" data-tip="{tip}" data-search="{html.escape(search)}" data-price="{pret or 0}">
  <div class="thumb">{thumb}{tipbadge}</div>
  <div class="meta">
    <div class="cod">{html.escape(str(d.get('cod_decor') or '—'))}</div>
    <div class="den">{html.escape(str(d.get('denumire') or ''))}</div>
    {dim_html}
    <div class="row"><span class="brand b-{d['brand'].lower()}">{d['brand']}</span><span class="pret">{pret_txt}<small>{(' '+pfurn) if pret else ''}</small></span></div>
  </div>
</div>''')

total = len(catalog)
cu_img = sum(1 for d in catalog if d.get("image"))
cu_pret = sum(1 for d in catalog if d.get("pret_ron"))
n_blat = sum(1 for d in catalog if d.get("tip") in ("blat","panou_spate"))
n_placa = total - n_blat

page = f'''<!doctype html><html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catalog decoruri — Egger · Kastamonu · AGT</title>
<style>
:root{{--bg:#0f1115;--card:#1a1d24;--tx:#e8eaed;--mut:#9aa0aa;--line:#2a2e37}}
*{{box-sizing:border-box}}
body{{margin:0;font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--tx)}}
header{{position:sticky;top:0;background:#12141a;border-bottom:1px solid var(--line);padding:12px 16px;z-index:5}}
h1{{margin:0 0 8px;font-size:16px}}
.sub{{color:var(--mut);font-size:12px;margin-bottom:10px}}
.controls{{display:flex;gap:8px;flex-wrap:wrap;align-items:center}}
input[type=search]{{flex:1;min-width:200px;padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:#0b0d11;color:var(--tx)}}
.filters{{display:flex;gap:6px;flex-wrap:wrap}}
.filters button{{padding:6px 12px;border-radius:20px;border:1px solid var(--line);background:#0b0d11;color:var(--tx);cursor:pointer;font-size:12px}}
.filters button.on{{background:#2d6cdf;border-color:#2d6cdf;color:#fff}}
.sep{{width:1px;background:var(--line);margin:0 4px}}
select{{padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:#0b0d11;color:var(--tx)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:16px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}}
.thumb{{position:relative;aspect-ratio:1/1;background:#0b0d11;display:flex;align-items:center;justify-content:center}}
.thumb img{{width:100%;height:100%;object-fit:cover}}
.noimg{{color:var(--mut);font-size:11px}}
.tip{{position:absolute;top:6px;left:6px;font-size:10px;padding:2px 6px;border-radius:4px;background:#c9822e;color:#fff}}
.t-panou_spate{{background:#8a5a2b}}
.meta{{padding:8px 10px}}
.cod{{font-weight:600;font-size:13px}}
.den{{color:var(--mut);font-size:12px;min-height:16px;margin:2px 0 4px}}
.dim{{color:#7f8894;font-size:10px;margin-bottom:6px}}
.row{{display:flex;justify-content:space-between;align-items:center}}
.brand{{font-size:10px;padding:2px 6px;border-radius:4px;background:#242a34;color:#cfd4dc}}
.b-egger{{background:#3a2d5a;color:#d7c8ff}} .b-kastamonu{{background:#2d4a3a;color:#bff0d0}} .b-agt{{background:#5a3a2d;color:#ffd7c8}}
.pret{{font-weight:600;font-size:12px}} .pret small{{color:var(--mut);font-weight:400}}
#count{{color:var(--mut);font-size:12px;margin-left:auto}}
</style></head><body>
<header>
  <h1>Catalog decoruri — Egger · Kastamonu · AGT</h1>
  <div class="sub">{total} produse ({n_placa} plăci · {n_blat} blaturi) · {cu_img} cu imagine · {cu_pret} cu preț · caută pe cod sau denumire</div>
  <div class="controls">
    <input id="q" type="search" placeholder="caută: U999, sonoma, gri, marmura, technotop...">
    <div class="filters" id="fbrand">
      <button data-f="all" class="on">Toate brandurile</button>
      <button data-f="Egger">Egger</button>
      <button data-f="Kastamonu">Kastamonu</button>
      <button data-f="AGT">AGT</button>
    </div>
    <div class="sep"></div>
    <div class="filters" id="ftip">
      <button data-t="all" class="on">Tot</button>
      <button data-t="placa">Plăci</button>
      <button data-t="blat">Blaturi</button>
    </div>
    <select id="sort">
      <option value="none">ordine catalog</option>
      <option value="pa">preț crescător</option>
      <option value="pd">preț descrescător</option>
    </select>
    <span id="count"></span>
  </div>
</header>
<div class="grid" id="grid">
{''.join(cards)}
</div>
<script>
const grid=document.getElementById('grid'), q=document.getElementById('q'), cnt=document.getElementById('count');
let brand='all', tip='all';
const cards=[...grid.children];
function apply(){{
  const s=q.value.trim().toLowerCase();
  let n=0;
  cards.forEach(c=>{{
    const tp=c.dataset.tip;
    const tipok = tip==='all' || (tip==='placa'?tp==='placa':(tp==='blat'||tp==='panou_spate'));
    const ok=(brand==='all'||c.dataset.brand===brand)&&tipok&&(!s||c.dataset.search.includes(s));
    c.style.display=ok?'':'none'; if(ok)n++;
  }});
  cnt.textContent=n+' rezultate';
}}
q.addEventListener('input',apply);
document.querySelectorAll('#fbrand button').forEach(b=>b.onclick=()=>{{
  document.querySelectorAll('#fbrand button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); brand=b.dataset.f; apply();
}});
document.querySelectorAll('#ftip button').forEach(b=>b.onclick=()=>{{
  document.querySelectorAll('#ftip button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); tip=b.dataset.t; apply();
}});
document.getElementById('sort').onchange=e=>{{
  const v=e.target.value; if(v==='none')return;
  const s=[...cards].sort((a,b)=>{{const pa=+a.dataset.price,pb=+b.dataset.price;
    return v==='pa'?(pa||1e9)-(pb||1e9):(pb)-(pa);}});
  s.forEach(c=>grid.appendChild(c));
}};
apply();
</script>
</body></html>'''

with open(GAL, "w") as f:
    f.write(page)
print(f"Galerie: {GAL}  ({total} produse: {n_placa} placi + {n_blat} blaturi)")
