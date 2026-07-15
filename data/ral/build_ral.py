#!/usr/bin/env python3
"""Construiește paletarul RAL Classic (JSON + galerie HTML) din CSV-ul sursă.

Sursă: https://gist.github.com/lunohodov/1995178 (RAL Classic, 215 culori).
Rulare: python3 data/ral/build_ral.py  (așteaptă /tmp/ral_raw.csv sau data/ral/ral_raw.csv)
"""
import csv, json, os, sys

SRC = next((p for p in ('/tmp/ral_raw.csv', 'data/ral/ral_raw.csv') if os.path.exists(p)), None)
if not SRC:
    sys.exit('Lipsește CSV-ul sursă (ral_raw.csv).')

GROUPS = {
    '1': ('yellow', 'Galben'),   '2': ('orange', 'Portocaliu'),
    '3': ('red', 'Roșu'),        '4': ('violet', 'Violet'),
    '5': ('blue', 'Albastru'),   '6': ('green', 'Verde'),
    '7': ('grey', 'Gri'),        '8': ('brown', 'Maro'),
    '9': ('whiteblack', 'Alb / Negru'),
}

# Culori „vii/translucide" listate explicit în oferta Paint Mob (suprataxă +13€/mp).
# Oferta spune „și altele de acest gen" → e o sugestie, rămâne overridable în UI.
VIVID = {
    '1016','1018','1021','1026','2005','2007','3000','3002','3005',
    '3024','3026','5002','5008','5010','6018','6024','9012',
}
# Negrurile (finisaj lucios pe negru = +6€/mp/față).
BLACK = {'9004','9005','9011','9017'}

rows = []
with open(SRC, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        code = r['RAL'].strip()               # "RAL 1000"
        num = code.replace('RAL', '').strip()  # "1000"
        g, g_ro = GROUPS.get(num[:1], ('other', 'Altele'))
        rows.append({
            'code': code,
            'num': num,
            'name_en': r['English'].strip(),
            'hex': r['HEX'].strip().upper(),
            'rgb': r['RGB'].strip(),
            'lrv': float(r['LRV']) if r.get('LRV') else None,
            'group': g,
            'group_ro': g_ro,
            'vivid': num in VIVID,   # sugestie suprataxă +13€/mp (overridable)
            'black': num in BLACK,   # lucios pe negru = +6€/mp/față
        })

os.makedirs('data/ral', exist_ok=True)
with open('data/ral/ral-classic.json', 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

# --- galerie HTML (swatch-uri CSS pe hex, căutare + filtre pe familie) ---
def contrast(hexv):
    r, g, b = (int(hexv[i:i+2], 16) for i in (1, 3, 5))
    # luminanță percepută → text alb/negru pentru lizibilitate pe swatch
    return '#111' if (0.299*r + 0.587*g + 0.114*b) > 150 else '#fff'

order = ['yellow','orange','red','violet','blue','green','grey','brown','whiteblack']
rows.sort(key=lambda x: (order.index(x['group']) if x['group'] in order else 99, x['num']))

# chip de filtru per familie de nuanțe (în ordinea RAL 1..9)
chips = ['<button data-f="all" class="on">Toate</button>'] + [
    f'<button data-f="{GROUPS[d][0]}">{GROUPS[d][1]}</button>' for d in '123456789'
]

cards = []
for c in rows:
    txt = contrast(c['hex'])
    search = f"{c['code']} {c['num']} {c['name_en']} {c['hex']}".lower()
    cards.append(
        f'<div class="card" data-group="{c["group"]}" data-search="{search}">'
        f'<div class="sw" style="background:{c["hex"]};color:{txt}">{c["num"]}</div>'
        f'<div class="meta"><div class="code">{c["code"]}</div>'
        f'<div class="name">{c["name_en"]}</div>'
        f'<div class="hex">{c["hex"]}</div></div></div>'
    )

html = f'''<!doctype html><html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paletar RAL Classic — {len(rows)} culori</title>
<style>
:root{{--bg:#0f1115;--card:#1a1d24;--tx:#e8eaed;--mut:#9aa0aa;--line:#2a2e37}}
*{{box-sizing:border-box}}
body{{margin:0;font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--tx)}}
header{{position:sticky;top:0;background:#12141a;border-bottom:1px solid var(--line);padding:12px 16px;z-index:5}}
h1{{margin:0 0 6px;font-size:16px}} .sub{{color:var(--mut);font-size:12px;margin-bottom:10px}}
.controls{{display:flex;gap:8px;flex-wrap:wrap;align-items:center}}
input[type=search]{{flex:1;min-width:200px;padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:#0b0d11;color:var(--tx)}}
.filters{{display:flex;gap:6px;flex-wrap:wrap}}
.filters button{{padding:6px 12px;border-radius:20px;border:1px solid var(--line);background:#0b0d11;color:var(--tx);cursor:pointer;font-size:12px}}
.filters button.on{{background:#2d6cdf;border-color:#2d6cdf;color:#fff}}
#count{{color:var(--mut);font-size:12px;margin-left:auto}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:16px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}}
.sw{{aspect-ratio:16/10;display:flex;align-items:flex-end;justify-content:flex-end;padding:6px 8px;font-size:11px;font-weight:600;opacity:.9}}
.meta{{padding:8px 10px}} .code{{font-weight:600;font-size:13px}}
.name{{color:var(--mut);font-size:12px;min-height:16px}} .hex{{color:#7f8894;font-size:11px;margin-top:2px}}
</style></head><body>
<header>
  <h1>Paletar RAL Classic — {len(rows)} culori</h1>
  <div class="sub">Referință de culoare pentru fronturi MDF vopsit (Paint Mob vopsește pe cod RAL). HEX-urile sunt aproximări sRGB — culoarea fizică se verifică pe evantaiul RAL.</div>
  <div class="controls">
    <input id="q" type="search" placeholder="caută: 9016, alb, RAL 7016, verde...">
    <div class="filters" id="fam">{''.join(chips)}</div>
    <span id="count"></span>
  </div>
</header>
<div class="grid" id="grid">
{''.join(cards)}
</div>
<script>
const q=document.getElementById('q'),grid=document.getElementById('grid'),count=document.getElementById('count');
let fam='all';
document.getElementById('fam').addEventListener('click',e=>{{
  if(e.target.tagName!=='BUTTON')return;
  fam=e.target.dataset.f;
  [...e.currentTarget.children].forEach(b=>b.classList.toggle('on',b===e.target));
  render();
}});
q.addEventListener('input',render);
function render(){{
  const s=q.value.trim().toLowerCase();let n=0;
  for(const c of grid.children){{
    const ok=(fam==='all'||c.dataset.group===fam)&&(!s||c.dataset.search.includes(s));
    c.style.display=ok?'':'none';if(ok)n++;
  }}
  count.textContent=n+' culori';
}}
render();
</script>
</body></html>'''

os.makedirs('public/ral', exist_ok=True)
with open('public/ral/galerie.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'RAL: {len(rows)} culori → data/ral/ral-classic.json + public/ral/galerie.html')
