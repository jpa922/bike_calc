// Built-in wheel/tire and groupset reference data.
//
// Source entries carry brand attribution, but identical tooth counts are merged
// for display: a 50/34 is a 50/34 no matter whose crank it's bolted to. Brands
// only stay separate when the actual teeth differ.
//
// Every tooth sequence below was checked against manufacturer or retailer
// listings in September 2026. Entries that could not be confirmed were removed
// rather than estimated. Sources, by group:
//   Shimano road 12s ...... si.shimano.com CS-R9200 / CS-R8100 / CS-R7100
//   Shimano road 11s ...... CS-R8000 listings
//   Shimano MTB 12s ....... CS-M9100 (10-45), CS-M6100/M7100/M8100 (10-51)
//   Shimano gravel 11s .... CS-HG700 11-34
//   SRAM road 12s ......... XG-1290 10-28 / 10-30 / 10-33 / 10-36
//   SRAM road 11s ......... PG-1170
//   SRAM gravel ........... XG-1271 XPLR 10-44 (SRAM support article)
//   SRAM MTB .............. XG-1299 10-50, XG-1295 10-52 (sram.com)
//   Campagnolo road 12s ... campagnolo.com Chorus 12s sprockets
//   Campagnolo Ekar 13s ... bikepacking.com Ekar launch coverage
//
// Known uncertainty: the Ekar 10-44's second-largest cog is listed as 38T by
// some retailers and 39T by others; 39T is used here.

export const RIM_BSD_PRESETS = [
  { label: '700c / 29" (ISO 622)', bsd: 622 },
  { label: '650b / 27.5" (ISO 584)', bsd: 584 },
  { label: '26" (ISO 559)', bsd: 559 },
  { label: '650c (ISO 571)', bsd: 571 },
  { label: '24" (ISO 507)', bsd: 507 },
  { label: '20" (ISO 406)', bsd: 406 },
];

export const TIRE_WIDTH_PRESETS = [
  { label: '23mm (road)', mm: 23 },
  { label: '25mm (road)', mm: 25 },
  { label: '28mm (road)', mm: 28 },
  { label: '32mm (road/gravel)', mm: 32 },
  { label: '38mm (gravel)', mm: 38 },
  { label: '42mm (gravel)', mm: 42 },
  { label: '47mm (gravel/all-road)', mm: 47 },
  { label: '2.1" (53mm, XC MTB)', mm: 53 },
  { label: '2.35" (60mm, trail MTB)', mm: 60 },
  { label: '2.5" (64mm, enduro MTB)', mm: 64 },
];

export const CATEGORIES = ['road', 'gravel', 'mtb'];

// --- Raw per-brand sources (merged by teeth below) ---

const RING_SOURCES = {
  road: [
    // Shimano 12s (FC-R9200 / R8100 / R7100)
    { brand: 'Shimano', teeth: [54, 40] },
    { brand: 'Shimano', teeth: [52, 36] },
    { brand: 'Shimano', teeth: [50, 34] },
    { brand: 'Shimano', teeth: [46, 36] },
    // SRAM eTap AXS 2x
    { brand: 'SRAM', teeth: [50, 37] },
    { brand: 'SRAM', teeth: [48, 35] },
    { brand: 'SRAM', teeth: [46, 33] },
    // Campagnolo 12s (Super Record / Record / Chorus)
    { brand: 'Campagnolo', teeth: [53, 39] },
    { brand: 'Campagnolo', teeth: [52, 36] },
    { brand: 'Campagnolo', teeth: [50, 34] },
  ],
  gravel: [
    // Shimano GRX (RX820 2x, RX610 2x, 1x)
    { brand: 'Shimano', teeth: [48, 31] },
    { brand: 'Shimano', teeth: [46, 30] },
    { brand: 'Shimano', teeth: [40] },
    { brand: 'Shimano', teeth: [42] },
    // SRAM 2x Wide + XPLR 1x direct mount
    { brand: 'SRAM', teeth: [46, 33] },
    { brand: 'SRAM', teeth: [43, 30] },
    { brand: 'SRAM', teeth: [38] },
    { brand: 'SRAM', teeth: [40] },
    { brand: 'SRAM', teeth: [42] },
    { brand: 'SRAM', teeth: [44] },
    { brand: 'SRAM', teeth: [46] },
    // Campagnolo Ekar
    { brand: 'Campagnolo', teeth: [38] },
    { brand: 'Campagnolo', teeth: [40] },
    { brand: 'Campagnolo', teeth: [42] },
    { brand: 'Campagnolo', teeth: [44] },
  ],
  mtb: [
    // Shimano SM-CRM95 (XTR) / SM-CRM85 (XT)
    { brand: 'Shimano', teeth: [30] },
    { brand: 'Shimano', teeth: [32] },
    { brand: 'Shimano', teeth: [34] },
    // SRAM Eagle direct mount
    { brand: 'SRAM', teeth: [30] },
    { brand: 'SRAM', teeth: [32] },
    { brand: 'SRAM', teeth: [34] },
    { brand: 'SRAM', teeth: [36] },
    { brand: 'SRAM', teeth: [38] },
  ],
};

const CASSETTE_SOURCES = {
  road: [
    // Shimano 12s
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 30] },
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30, 34] },
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 32, 36] },
    // Shimano 11s (CS-R8000)
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 15, 16, 17, 19, 21, 23, 25] },
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28] },
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 16, 18, 20, 22, 25, 28, 32] },
    // SRAM 12s (XG-1290)
    { brand: 'SRAM', teeth: [10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 28] },
    { brand: 'SRAM', teeth: [10, 11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30] },
    { brand: 'SRAM', teeth: [10, 11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 33] },
    { brand: 'SRAM', teeth: [10, 11, 12, 13, 15, 17, 19, 21, 24, 28, 32, 36] },
    // SRAM 11s (PG-1170)
    { brand: 'SRAM', teeth: [11, 12, 13, 14, 15, 16, 17, 19, 21, 23, 25] },
    { brand: 'SRAM', teeth: [11, 12, 13, 14, 15, 16, 17, 19, 22, 25, 28] },
    // Campagnolo 12s
    { brand: 'Campagnolo', teeth: [11, 12, 13, 14, 15, 16, 17, 19, 21, 23, 26, 29] },
    { brand: 'Campagnolo', teeth: [11, 12, 13, 14, 15, 16, 17, 19, 22, 25, 28, 32] },
    { brand: 'Campagnolo', teeth: [11, 12, 13, 14, 15, 16, 17, 19, 22, 25, 29, 34] },
  ],
  gravel: [
    // Shimano: CS-HG700 11s, GRX 12s 2x pairings, XT/XTR 12s for 1x
    { brand: 'Shimano', teeth: [11, 13, 15, 17, 19, 21, 23, 25, 27, 30, 34] },
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30, 34] },
    { brand: 'Shimano', teeth: [11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 32, 36] },
    { brand: 'Shimano', teeth: [10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 40, 45] },
    { brand: 'Shimano', teeth: [10, 12, 14, 16, 18, 21, 24, 28, 33, 39, 45, 51] },
    // SRAM XPLR / Wide
    { brand: 'SRAM', teeth: [10, 11, 13, 15, 17, 19, 21, 24, 28, 32, 38, 44] },
    { brand: 'SRAM', teeth: [10, 11, 12, 13, 15, 17, 19, 21, 24, 28, 32, 36] },
    // Campagnolo Ekar 13s
    { brand: 'Campagnolo', teeth: [9, 10, 11, 12, 13, 14, 16, 18, 20, 23, 27, 31, 36] },
    { brand: 'Campagnolo', teeth: [9, 10, 11, 12, 13, 14, 16, 18, 21, 25, 30, 36, 42] },
    { brand: 'Campagnolo', teeth: [10, 11, 12, 13, 14, 15, 17, 19, 22, 26, 32, 39, 44] },
  ],
  mtb: [
    { brand: 'Shimano', teeth: [10, 12, 14, 16, 18, 21, 24, 28, 33, 39, 45, 51] },
    { brand: 'Shimano', teeth: [10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 40, 45] },
    { brand: 'SRAM', teeth: [10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 42, 50] },
    { brand: 'SRAM', teeth: [10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 42, 52] },
  ],
};

function mergeByTeeth(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = entry.teeth.join(',');
    if (!map.has(key)) map.set(key, { teeth: entry.teeth, brands: [] });
    const merged = map.get(key);
    if (!merged.brands.includes(entry.brand)) merged.brands.push(entry.brand);
  }
  return [...map.values()];
}

function ringLabel({ teeth, brands }) {
  const desc = [...teeth].sort((a, b) => b - a);
  const name = desc.length > 1 ? `${desc.join('/')}T` : `${desc[0]}T (1x)`;
  return `${name} · ${brands.join(', ')}`;
}

function cassetteLabel({ teeth, brands }) {
  const asc = [...teeth].sort((a, b) => a - b);
  return `${asc[0]}-${asc[asc.length - 1]} (${asc.length}s) · ${brands.join(', ')}`;
}

function buildOptions(sources, labelFn, sortFn) {
  const out = {};
  for (const [category, entries] of Object.entries(sources)) {
    out[category] = mergeByTeeth(entries)
      .map((e) => ({ ...e, label: labelFn(e) }))
      .sort(sortFn);
  }
  return out;
}

const maxOf = (arr) => Math.max(...arr);
const minOf = (arr) => Math.min(...arr);

export const RING_OPTIONS = buildOptions(RING_SOURCES, ringLabel, (a, b) => {
  // 2x before 1x, then largest ring descending, then small ring descending.
  if ((b.teeth.length > 1) !== (a.teeth.length > 1)) return b.teeth.length - a.teeth.length;
  if (maxOf(b.teeth) !== maxOf(a.teeth)) return maxOf(b.teeth) - maxOf(a.teeth);
  return minOf(b.teeth) - minOf(a.teeth);
});

export const CASSETTE_OPTIONS = buildOptions(CASSETTE_SOURCES, cassetteLabel, (a, b) => {
  // Most cogs first, so current 12/13-speed options lead rather than legacy 11-speed.
  if (a.teeth.length !== b.teeth.length) return b.teeth.length - a.teeth.length;
  return maxOf(a.teeth) - maxOf(b.teeth);
});
