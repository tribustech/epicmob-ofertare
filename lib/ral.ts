import { readFileSync } from 'node:fs';
import path from 'node:path';

export type RalColor = {
  code: string;
  num: string;
  name_en: string;
  hex: string;
  rgb: string;
  lrv: number | null;
  group: string;
  group_ro: string;
  vivid: boolean;
  black: boolean;
};

let cache: RalColor[] | null = null;

export function getRalColors(): RalColor[] {
  if (cache === null) {
    const file = path.join(process.cwd(), 'data', 'ral', 'ral-classic.json');
    cache = JSON.parse(readFileSync(file, 'utf-8')) as RalColor[];
  }
  return cache;
}

function normalizeCode(code: string): string {
  const trimmed = code.trim().toUpperCase();
  return trimmed.startsWith('RAL') ? trimmed : `RAL ${trimmed}`;
}

export function findRal(code: string): RalColor | undefined {
  const target = normalizeCode(code);
  return getRalColors().find((c) => c.code.toUpperCase() === target);
}

export function isRalBlack(code: string): boolean {
  return findRal(code)?.black ?? false;
}

export function ralIsVivid(code: string): boolean {
  return findRal(code)?.vivid ?? false;
}
