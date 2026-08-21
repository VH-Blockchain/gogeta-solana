export function formatUnits(value: bigint | string, decimals: number): string {
  let v = value.toString();
  if (v === '0') return '0';
  const isNegative = v.startsWith('-');
  if (isNegative) v = v.slice(1);
  const pad = Math.max(0, decimals - v.length + 1);
  v = '0'.repeat(pad) + v;
  const whole = v.slice(0, v.length - decimals);
  const frac = v.slice(v.length - decimals).replace(/0+$/, '');
  const res = frac ? `${whole}.${frac}` : whole;
  return isNegative ? `-${res}` : res;
}

export function parseUnits(value: string, decimals: number): bigint {
  let [whole = '0', frac = '0'] = value.split('.');
  if (!frac) frac = '';
  if (frac.length > decimals) {
    frac = frac.slice(0, decimals);
  } else {
    frac = frac.padEnd(decimals, '0');
  }
  return BigInt(whole + frac);
}
