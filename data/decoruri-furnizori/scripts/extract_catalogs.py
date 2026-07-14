#!/usr/bin/env python3
"""Extrage blocul JSON de catalog din transcriptul JSONL al fiecarui agent, fara a-l afisa integral."""
import json, re, os, sys

TASKS = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/tasks"
OUT = "/private/tmp/claude-501/-Users-andrewradulescu-Documents-Projects-EpicMob-epic-mob-ofertare/fb2523c4-90f4-47ae-a954-a6bfa9aad991/scratchpad"

JOBS = [
    ("a83eba98d1b9e445f", "Egger", "cat_egger.json"),
    ("ad8c36127005acabc", "AGT",   "cat_agt.json"),
]

def all_text_from_jsonl(path):
    """Aduna tot textul din mesajele transcriptului."""
    texts = []
    with open(path, errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            # cauta recursiv campuri 'text'
            stack = [obj]
            while stack:
                cur = stack.pop()
                if isinstance(cur, dict):
                    for k, v in cur.items():
                        if k == "text" and isinstance(v, str):
                            texts.append(v)
                        else:
                            stack.append(v)
                elif isinstance(cur, list):
                    stack.extend(cur)
    return texts

def find_catalog_json(texts):
    for t in texts:
        if '"decoruri"' not in t:
            continue
        # extrage blocul ```json ... ```
        m = re.search(r'```json\s*(\{.*?\})\s*```', t, re.S)
        cand = m.group(1) if m else None
        if not cand:
            # fallback: de la primul { la ultimul }
            i, j = t.find('{'), t.rfind('}')
            if i >= 0 and j > i:
                cand = t[i:j+1]
        if cand:
            try:
                return json.loads(cand)
            except Exception:
                continue
    return None

for task_id, brand, outname in JOBS:
    path = os.path.join(TASKS, f"{task_id}.output")
    if not os.path.exists(path):
        print(f"[{brand}] LIPSA {path}")
        continue
    texts = all_text_from_jsonl(path)
    data = find_catalog_json(texts)
    if not data or "decoruri" not in data:
        print(f"[{brand}] nu am gasit blocul JSON de catalog")
        continue
    with open(os.path.join(OUT, outname), "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"[{brand}] {len(data['decoruri'])} decoruri -> {outname}")
