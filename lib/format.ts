export function fmtLei(n: number): string {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei';
}

export function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('ro-RO', { maximumFractionDigits: decimals });
}
