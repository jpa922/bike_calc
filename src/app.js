import { RIM_BSD_PRESETS, TIRE_WIDTH_PRESETS, RING_OPTIONS, CASSETTE_OPTIONS, CATEGORIES } from './data.js';
import { computeWheelDiameterMm, circumferenceFromDiameterMm } from './wheel.js';
import {
  buildCombos,
  buildSynchroLadder,
  findBestComboForSpeed,
  developmentMm,
  gearInches,
  gainRatio,
  cadenceFeel,
  speedKmhFromCadence,
  largestStepFactor,
  stepDeviationRpm,
  cadenceCoverage,
} from './gearing.js';

const $ = (id) => document.getElementById(id);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Bike names are free text and several renderers build markup as strings. */
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
const MPH_TO_KMH = 1.609344;
const MAX_ROWS = 200;
const MAX_BIKES = 3;
const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

const els = {
  addBikeBtn: $('add-bike-btn'),
  removeBikeBtn: $('remove-bike-btn'),
  bikeTabs: $('bike-tabs'),
  multiBikeHint: $('multi-bike-hint'),
  bikeName: $('bike-name'),
  crankLength: $('crank-length'),

  rimPreset: $('rim-preset'),
  customBsdWrap: $('custom-bsd-wrap'),
  customBsd: $('custom-bsd'),
  tirePreset: $('tire-preset'),
  customTireWrap: $('custom-tire-wrap'),
  customTire: $('custom-tire'),
  profileFactor: $('profile-factor'),
  profileFactorValue: $('profile-factor-value'),
  useOverrideCirc: $('use-override-circ'),
  overrideCircWrap: $('override-circ-wrap'),
  overrideCirc: $('override-circ'),
  wheelDiameterOut: $('wheel-diameter-out'),
  wheelCircOut: $('wheel-circ-out'),

  categorySelect: $('category-select'),
  ringPreset: $('ring-preset'),
  customRingsWrap: $('custom-rings-wrap'),
  customRings: $('custom-rings'),
  cassettePreset: $('cassette-preset'),
  customCogsWrap: $('custom-cogs-wrap'),
  customCogs: $('custom-cogs'),
  avoidCrossChain: $('avoid-cross-chain'),
  ringModeWrap: $('ring-mode-wrap'),
  perRingOption: $('per-ring-option'),
  compensationWrap: $('compensation-wrap'),
  compensationCogs: $('compensation-cogs'),

  preferredCadence: $('preferred-cadence'),
  speedUnit: $('speed-unit'),
  speedPresets: $('speed-presets'),
  speedMin: $('speed-min'),
  speedMax: $('speed-max'),
  speedStep: $('speed-step'),
  calculateBtn: $('calculate-btn'),
  formErrors: $('form-errors'),

  resultsPanel: $('results-panel'),
  summaryWrap: $('summary-wrap'),
  summaryThead: document.querySelector('#summary-table thead'),
  summaryTbody: document.querySelector('#summary-table tbody'),
  bySpeedThead: document.querySelector('#by-speed-table thead'),
  bySpeedTbody: document.querySelector('#by-speed-table tbody'),
  allGearsTbody: document.querySelector('#all-gears-table tbody'),
  chart: $('cadence-chart'),
  chartLegend: $('chart-legend'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: { 'by-speed': $('tab-by-speed'), 'all-gears': $('tab-all-gears') },
};

// Each bike owns its wheel, drivetrain and cranks; ride parameters are shared.
const BIKE_FIELDS = [
  ['name', 'bikeName', 'value'],
  ['crankLength', 'crankLength', 'value'],
  ['rimPreset', 'rimPreset', 'value'],
  ['customBsd', 'customBsd', 'value'],
  ['tirePreset', 'tirePreset', 'value'],
  ['customTire', 'customTire', 'value'],
  ['profileFactor', 'profileFactor', 'value'],
  ['useOverrideCirc', 'useOverrideCirc', 'checked'],
  ['overrideCirc', 'overrideCirc', 'value'],
  ['category', 'categorySelect', 'value'],
  ['ringPreset', 'ringPreset', 'value'],
  ['customRings', 'customRings', 'value'],
  ['cassettePreset', 'cassettePreset', 'value'],
  ['customCogs', 'customCogs', 'value'],
  ['avoidCrossChain', 'avoidCrossChain', 'checked'],
  ['compensationCogs', 'compensationCogs', 'value'],
];

function createBike(name, source) {
  if (source) return { ...source, name };
  return {
    name,
    crankLength: '172.5',
    rimPreset: '0',
    customBsd: '622',
    tirePreset: '2',
    customTire: '28',
    profileFactor: '1',
    useOverrideCirc: false,
    overrideCirc: '',
    category: 'road',
    ringPreset: '0',
    customRings: '',
    cassettePreset: '0',
    customCogs: '',
    avoidCrossChain: true,
    ringMode: 'synchro',
    compensationCogs: '2',
  };
}

/** per-ring splits one bike into several series, so it can't apply to a comparison. */
function effectiveRingMode(bike, bikeCount) {
  if (bikeCount > 1 && bike.ringMode === 'per-ring') return 'synchro';
  return bike.ringMode;
}

const state = {
  bikes: [createBike('Bike 1')],
  activeIndex: 0,
  speedUnit: 'mph', // tracked so a unit switch can convert the range in place
  lastChart: null, // kept so a viewport change can redraw at the new width
};
const activeBike = () => state.bikes[state.activeIndex];

// --- option population ---

function populateSelect(select, items) {
  select.innerHTML = '';
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    select.appendChild(opt);
  }
}

function initStaticOptions() {
  populateSelect(els.rimPreset, [
    ...RIM_BSD_PRESETS.map((p, i) => ({ value: i, label: p.label })),
    { value: 'custom', label: 'Custom…' },
  ]);
  populateSelect(els.tirePreset, [
    ...TIRE_WIDTH_PRESETS.map((p, i) => ({ value: i, label: p.label })),
    { value: 'custom', label: 'Custom…' },
  ]);
  populateSelect(
    els.categorySelect,
    CATEGORIES.map((c) => ({ value: c, label: c === 'mtb' ? 'MTB' : c[0].toUpperCase() + c.slice(1) }))
  );
}

function refreshDrivetrainOptions(category) {
  populateSelect(els.ringPreset, [
    ...(RING_OPTIONS[category] || []).map((o, i) => ({ value: i, label: o.label })),
    { value: 'custom', label: 'Custom…' },
  ]);
  populateSelect(els.cassettePreset, [
    ...(CASSETTE_OPTIONS[category] || []).map((o, i) => ({ value: i, label: o.label })),
    { value: 'custom', label: 'Custom…' },
  ]);
}

// --- form <-> state binding ---

function saveFormToActiveBike() {
  const bike = activeBike();
  for (const [key, elKey, prop] of BIKE_FIELDS) bike[key] = els[elKey][prop];
  const checked = document.querySelector('input[name="ring-mode"]:checked');
  if (checked) bike.ringMode = checked.value;
}

function loadBikeIntoForm(bike) {
  // Category drives which ring/cassette options exist, so it has to land first.
  els.categorySelect.value = bike.category;
  refreshDrivetrainOptions(bike.category);
  for (const [key, elKey, prop] of BIKE_FIELDS) {
    if (key === 'category') continue;
    els[elKey][prop] = bike[key];
  }
  // A cloned bike may carry a preset index the new category doesn't have.
  if (!els.ringPreset.value) els.ringPreset.value = '0';
  if (!els.cassettePreset.value) els.cassettePreset.value = '0';
  const radio = document.querySelector(`input[name="ring-mode"][value="${bike.ringMode}"]`);
  if (radio) radio.checked = true;
  els.profileFactorValue.textContent = parseFloat(bike.profileFactor).toFixed(2);
  updateConditionalVisibility();
  updateWheelOutputs();
}

function renderBikeTabs() {
  els.bikeTabs.innerHTML = '';
  state.bikes.forEach((bike, i) => {
    const btn = document.createElement('button');
    btn.className = 'bike-tab' + (i === state.activeIndex ? ' active' : '');
    btn.textContent = bike.name || `Bike ${i + 1}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(i === state.activeIndex));
    btn.style.borderBottomColor = i === state.activeIndex ? SERIES_COLORS[i % SERIES_COLORS.length] : '';
    btn.addEventListener('click', () => {
      saveFormToActiveBike();
      state.activeIndex = i;
      loadBikeIntoForm(activeBike());
      renderBikeTabs();
    });
    els.bikeTabs.appendChild(btn);
  });
  els.addBikeBtn.hidden = state.bikes.length >= MAX_BIKES;
  els.removeBikeBtn.hidden = state.bikes.length < 2;
  els.multiBikeHint.hidden = state.bikes.length < 2;
}

function updateConditionalVisibility() {
  els.customBsdWrap.hidden = els.rimPreset.value !== 'custom';
  els.customTireWrap.hidden = els.tirePreset.value !== 'custom';
  els.customRingsWrap.hidden = els.ringPreset.value !== 'custom';
  els.customCogsWrap.hidden = els.cassettePreset.value !== 'custom';
  els.overrideCircWrap.hidden = !els.useOverrideCirc.checked;

  const isMulti = state.bikes.length > 1;
  els.ringModeWrap.hidden = bikeRings(activeBike()).teeth.length < 2;
  // per-ring splits one bike across several series, so it can't apply to a comparison.
  els.perRingOption.hidden = isMulti;
  if (isMulti && document.querySelector('input[name="ring-mode"]:checked')?.value === 'per-ring') {
    document.querySelector('input[name="ring-mode"][value="synchro"]').checked = true;
    activeBike().ringMode = 'synchro';
  }
  els.compensationWrap.hidden =
    document.querySelector('input[name="ring-mode"]:checked')?.value !== 'synchro';
}

// --- per-bike validation & derivation ---

function parseTeethList(str) {
  const parts = String(str).split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const teeth = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
    teeth.push(n);
  }
  return teeth.length ? teeth : null;
}

function bikeRings(bike) {
  if (bike.ringPreset === 'custom') {
    const teeth = parseTeethList(bike.customRings);
    if (!teeth) return { teeth: [], error: 'enter chainrings as whole numbers separated by commas, e.g. 50,34' };
    if (teeth.some((t) => t < 20 || t > 70)) return { teeth: [], error: 'each chainring should be between 20T and 70T' };
    return { teeth };
  }
  const option = (RING_OPTIONS[bike.category] || [])[parseInt(bike.ringPreset, 10)];
  return option ? { teeth: option.teeth } : { teeth: [], error: 'pick a chainring option' };
}

function bikeCogs(bike) {
  if (bike.cassettePreset === 'custom') {
    const teeth = parseTeethList(bike.customCogs);
    if (!teeth) return { teeth: [], error: 'enter cassette cogs as whole numbers separated by commas, e.g. 11,13,15,18' };
    if (teeth.length < 2) return { teeth: [], error: 'enter at least two cassette cogs' };
    if (teeth.some((t) => t < 8 || t > 60)) return { teeth: [], error: 'each cog should be between 8T and 60T' };
    return { teeth };
  }
  const option = (CASSETTE_OPTIONS[bike.category] || [])[parseInt(bike.cassettePreset, 10)];
  return option ? { teeth: option.teeth } : { teeth: [], error: 'pick a cassette option' };
}

function bikeCircumference(bike) {
  if (bike.useOverrideCirc) {
    const v = parseFloat(bike.overrideCirc);
    if (!Number.isFinite(v) || v <= 0) return { value: null, error: 'measured circumference must be a positive number of mm' };
    return { value: v };
  }
  const bsd = bike.rimPreset === 'custom' ? parseFloat(bike.customBsd) : RIM_BSD_PRESETS[parseInt(bike.rimPreset, 10)]?.bsd;
  const width = bike.tirePreset === 'custom' ? parseFloat(bike.customTire) : TIRE_WIDTH_PRESETS[parseInt(bike.tirePreset, 10)]?.mm;
  if (!Number.isFinite(bsd) || bsd <= 0) return { value: null, error: 'rim BSD must be a positive number of mm' };
  if (!Number.isFinite(width) || width <= 0) return { value: null, error: 'tire width must be a positive number of mm' };
  const diameter = computeWheelDiameterMm({ bsdMm: bsd, tireWidthMm: width, profileFactor: parseFloat(bike.profileFactor) });
  return { value: circumferenceFromDiameterMm(diameter) };
}

function buildBikeConfig(bike, index, bikeCount) {
  const errors = [];
  const label = bike.name || `Bike ${index + 1}`;

  const circ = bikeCircumference(bike);
  if (circ.error) errors.push(`${label}: ${circ.error}`);
  const rings = bikeRings(bike);
  if (rings.error) errors.push(`${label}: ${rings.error}`);
  const cogs = bikeCogs(bike);
  if (cogs.error) errors.push(`${label}: ${cogs.error}`);

  const crankLength = parseFloat(bike.crankLength);
  if (!Number.isFinite(crankLength) || crankLength < 100 || crankLength > 250) {
    errors.push(`${label}: crank length should be between 100 and 250 mm`);
  }
  if (errors.length) return { errors };

  const sortedRings = [...rings.teeth].sort((a, b) => a - b);
  const sortedCogs = [...cogs.teeth].sort((a, b) => a - b);
  const combos = buildCombos(sortedRings, sortedCogs, { avoidCrossChain: bike.avoidCrossChain });
  if (!combos.length) {
    return { errors: [`${label}: that combination leaves no usable gears — try turning off cross-chain avoidance`] };
  }

  const ringMode = effectiveRingMode(bike, bikeCount);
  const compensationCogs = Math.min(4, Math.max(1, parseInt(bike.compensationCogs, 10) || 2));
  // The gears you can actually reach, in the order you'd reach them.
  const gears =
    ringMode === 'synchro' && sortedRings.length > 1
      ? buildSynchroLadder(combos, { compensationCogs })
      : [...combos].sort((a, b) => a.ratio - b.ratio);

  return {
    errors: [],
    cfg: {
      label,
      index,
      circMm: circ.value,
      rings: sortedRings,
      cogs: sortedCogs,
      crankLength,
      ringMode,
      compensationCogs,
      combos,
      gears,
    },
  };
}

function buildSpeedSeries(min, max, step) {
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  return Array.from({ length: count }, (_, i) => min + i * step);
}

function readRideParams() {
  const errors = [];
  const preferredCadence = parseFloat(els.preferredCadence.value);
  if (!Number.isFinite(preferredCadence) || preferredCadence < 30 || preferredCadence > 200) {
    errors.push('Preferred cadence: enter a value between 30 and 200 rpm');
  }
  const minSpeed = parseFloat(els.speedMin.value);
  const maxSpeed = parseFloat(els.speedMax.value);
  const step = parseFloat(els.speedStep.value);
  if (!Number.isFinite(minSpeed) || minSpeed <= 0) errors.push('Min speed: enter a positive number');
  if (!Number.isFinite(maxSpeed) || maxSpeed <= 0) errors.push('Max speed: enter a positive number');
  if (!Number.isFinite(step) || step <= 0) errors.push('Step: enter a positive number');
  if (Number.isFinite(minSpeed) && Number.isFinite(maxSpeed) && maxSpeed < minSpeed) {
    errors.push('Max speed must be greater than or equal to min speed');
  }
  if (Number.isFinite(minSpeed) && Number.isFinite(maxSpeed) && Number.isFinite(step) && step > 0 && maxSpeed >= minSpeed) {
    const count = Math.floor((maxSpeed - minSpeed) / step + 1e-9) + 1;
    if (count > MAX_ROWS) errors.push(`That range produces ${count} rows — increase the step so it's ${MAX_ROWS} or fewer`);
  }
  if (errors.length) return { errors };
  return {
    errors: [],
    preferredCadence,
    unit: els.speedUnit.value,
    speeds: buildSpeedSeries(minSpeed, maxSpeed, step),
  };
}

/**
 * Speed bands riders actually think in. Each unit gets its own round numbers
 * rather than a converted value, and these only pre-fill the min/max/step
 * inputs — they stay visible and editable.
 */
const SPEED_PRESETS = [
  { label: 'Climbing', mph: [3, 12, 0.5], kmh: [5, 20, 1] },
  { label: 'Rolling', mph: [10, 22, 1], kmh: [16, 35, 2] },
  { label: 'Fast group', mph: [16, 32, 1], kmh: [26, 50, 2] },
  { label: 'Everything', mph: [3, 32, 1], kmh: [5, 50, 2] },
];

function renderSpeedPresets() {
  els.speedPresets.innerHTML = '';
  SPEED_PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      const [min, max, step] = preset[els.speedUnit.value];
      els.speedMin.value = min;
      els.speedMax.value = max;
      els.speedStep.value = step;
      runCalculation();
    });
    els.speedPresets.appendChild(btn);
  });
}

/** Switching units should keep the same real-world range, not reinterpret it. */
function convertSpeedFields(fromUnit, toUnit) {
  if (fromUnit === toUnit) return;
  const factor = toUnit === 'kmh' ? MPH_TO_KMH : 1 / MPH_TO_KMH;
  const scale = (el, round) => {
    const v = parseFloat(el.value);
    if (Number.isFinite(v)) el.value = round(v * factor);
  };
  scale(els.speedMin, (v) => Math.max(1, Math.round(v)));
  scale(els.speedMax, (v) => Math.max(1, Math.round(v)));
  scale(els.speedStep, (v) => Math.max(0.5, Math.round(v * 2) / 2));
}

function showErrors(errors) {
  els.formErrors.innerHTML = '';
  for (const message of errors) {
    const li = document.createElement('li');
    li.textContent = message;
    els.formErrors.appendChild(li);
  }
  els.formErrors.hidden = errors.length === 0;
}

// --- unit helpers ---

const speedToKmh = (v, unit) => (unit === 'mph' ? v * MPH_TO_KMH : v);
const kmhToUnit = (kmh, unit) => (unit === 'mph' ? kmh / MPH_TO_KMH : kmh);
const unitLabel = (unit) => (unit === 'mph' ? 'mph' : 'km/h');
const fmtSpeed = (kmh, unit) => `${kmhToUnit(kmh, unit).toFixed(1)} ${unitLabel(unit)}`;

function updateWheelOutputs() {
  const circ = bikeCircumference(activeBike());
  if (circ.error) {
    els.wheelDiameterOut.textContent = '—';
    els.wheelCircOut.textContent = '—';
    return;
  }
  const diameterMm = circ.value / Math.PI;
  els.wheelDiameterOut.textContent = `${diameterMm.toFixed(1)} mm (${(diameterMm / 25.4).toFixed(2)} in)`;
  els.wheelCircOut.textContent = `${circ.value.toFixed(0)} mm (${(circ.value / 1000).toFixed(3)} m)`;
}

function feelPillClass(label) {
  if (label === 'On target') return 'good';
  if (label.startsWith('Grinding') || label.startsWith('Spun out')) return 'bad';
  return 'warn';
}

const ringsLabel = (rings) => (rings.length > 1 ? `${[...rings].sort((a, b) => b - a).join('/')}T` : `${rings[0]}T`);
const cogsLabel = (cogs) => `${cogs[0]}-${cogs[cogs.length - 1]}`;

// --- calculation ---

/**
 * One series per bike when comparing; one series per chainring when a single
 * 2x bike is in per-ring mode.
 */
function computeSeries(bikeCfgs, ride) {
  const single = bikeCfgs.length === 1 ? bikeCfgs[0] : null;
  const perRing = single && single.ringMode === 'per-ring' && single.rings.length > 1;

  const groups = perRing
    ? single.rings.map((ring) => ({
        label: `${ring}T ring`,
        cfg: single,
        combos: single.combos.filter((c) => c.ring === ring),
      }))
    : bikeCfgs.map((cfg) => ({ label: cfg.label, cfg, combos: cfg.gears }));

  const layout = perRing ? 'ring' : bikeCfgs.length > 1 ? 'bike' : 'single';

  return {
    layout,
    series: groups
      .filter((g) => g.combos.length > 0)
      .map((g) => ({
        label: g.label,
        cfg: g.cfg,
        points: ride.speeds.map((v) => {
          const best = findBestComboForSpeed({
            speedKmh: speedToKmh(v, ride.unit),
            combos: g.combos,
            circumferenceMm: g.cfg.circMm,
            preferredCadence: ride.preferredCadence,
          });
          return {
            speedDisplay: v,
            best,
            feel: cadenceFeel(best.cadence, ride.preferredCadence),
          };
        }),
      })),
  };
}

function computeAllGearGroups(bikeCfgs, ride) {
  const groups = [];
  const showBikeName = bikeCfgs.length > 1;

  for (const cfg of bikeCfgs) {
    const wheelDiameterMm = cfg.circMm / Math.PI;
    const decorate = (c) => {
      const dev = developmentMm(cfg.circMm, c.ratio);
      return {
        ...c,
        developmentMm: dev,
        gearInches: gearInches(c.ring, c.cog, wheelDiameterMm),
        gainRatio: gainRatio(c.ring, c.cog, wheelDiameterMm, cfg.crankLength),
        speedAtPreferredKmh: speedKmhFromCadence(ride.preferredCadence, dev),
      };
    };
    const addJumps = (rows) => {
      rows.forEach((row, i) => {
        row.jumpPct = i < rows.length - 1 ? ((rows[i + 1].ratio - row.ratio) / row.ratio) * 100 : null;
        row.ringShift = i > 0 && row.ring !== rows[i - 1].ring;
      });
      return rows;
    };

    // In synchro the ladder IS the shift sequence, so list it in ride order and
    // let the jump column span the ring change.
    if (cfg.ringMode === 'synchro' && cfg.rings.length > 1) {
      const rows = addJumps(cfg.gears.map(decorate));
      const parts = showBikeName ? [cfg.label, 'synchro ladder'] : ['Synchro ladder'];
      groups.push({ label: parts.join(' · '), rows, showHeader: true });
      continue;
    }

    const byRing = new Map();
    for (const c of cfg.combos) {
      if (!byRing.has(c.ring)) byRing.set(c.ring, []);
      byRing.get(c.ring).push(decorate(c));
    }
    const multiRing = byRing.size > 1;
    for (const [ring, rows] of [...byRing.entries()].sort((a, b) => a[0] - b[0])) {
      rows.sort((a, b) => a.ratio - b.ratio);
      // Only the step to the next cog on the SAME ring is a shift you'd make.
      addJumps(rows);
      const parts = [];
      if (showBikeName) parts.push(cfg.label);
      if (multiRing) parts.push(`${ring}T chainring`);
      groups.push({ label: parts.join(' · '), rows, showHeader: parts.length > 0 });
    }
  }
  return groups;
}

function computeSummaries(bikeCfgs, ride) {
  const minSpeedKmh = speedToKmh(ride.speeds[0], ride.unit);
  const maxSpeedKmh = speedToKmh(ride.speeds[ride.speeds.length - 1], ride.unit);

  return bikeCfgs.map((cfg) => {
    const sorted = [...cfg.gears].sort((a, b) => a.ratio - b.ratio);
    const easiest = sorted[0];
    const hardest = sorted[sorted.length - 1];
    const devFor = (c) => developmentMm(cfg.circMm, c.ratio);

    // In per-ring mode the widest step you'd actually ride is within a ring —
    // a ring change isn't a step you take to close a cadence gap.
    const stepSequences =
      cfg.ringMode === 'per-ring' && cfg.rings.length > 1
        ? cfg.rings.map((ring) => cfg.combos.filter((c) => c.ring === ring).sort((a, b) => a.ratio - b.ratio))
        : [cfg.gears];
    const worstStep = Math.max(...stepSequences.map(largestStepFactor));

    return {
      label: cfg.label,
      index: cfg.index,
      circMm: cfg.circMm,
      gearing: `${ringsLabel(cfg.rings)} × ${cogsLabel(cfg.cogs)}`,
      gearCount: cfg.gears.length,
      ringMode: cfg.ringMode,
      isMultiRing: cfg.rings.length > 1,
      rangePct: (hardest.ratio / easiest.ratio) * 100,
      worstStepPct: (worstStep - 1) * 100,
      holdRpm: stepDeviationRpm(worstStep, ride.preferredCadence),
      coverage: cadenceCoverage({
        gears: cfg.gears,
        circumferenceMm: cfg.circMm,
        targetCadence: ride.preferredCadence,
        minSpeedKmh,
        maxSpeedKmh,
      }),
      easiest: { combo: easiest, dev: devFor(easiest), speedKmh: speedKmhFromCadence(ride.preferredCadence, devFor(easiest)) },
      hardest: { combo: hardest, dev: devFor(hardest), speedKmh: speedKmhFromCadence(ride.preferredCadence, devFor(hardest)) },
    };
  });
}

function runCalculation() {
  saveFormToActiveBike();

  const ride = readRideParams();
  const errors = [...ride.errors];
  const bikeCfgs = [];
  state.bikes.forEach((bike, i) => {
    const built = buildBikeConfig(bike, i, state.bikes.length);
    errors.push(...built.errors);
    if (built.cfg) bikeCfgs.push(built.cfg);
  });

  if (errors.length) {
    showErrors(errors);
    els.resultsPanel.hidden = true;
    return;
  }
  showErrors([]);

  const { layout, series } = computeSeries(bikeCfgs, ride);
  state.lastChart = { series, ride };
  renderSummary(computeSummaries(bikeCfgs, ride), ride);
  renderBySpeedTable(series, layout, ride);
  renderChart(series, ride);
  renderAllGearsTable(computeAllGearGroups(bikeCfgs, ride), ride);
  els.resultsPanel.hidden = false;
}

// --- rendering ---

function swatch(index) {
  return `<span class="swatch" style="background:${SERIES_COLORS[index % SERIES_COLORS.length]}"></span>`;
}

const MODE_NOTE = { synchro: 'synchro ladder', optimal: 'optimal (not rideable)', 'per-ring': 'within each ring' };

/**
 * Bikes as columns, metrics as rows. Transposed because comparing a metric
 * across bikes means reading along one row, and because at most four columns
 * fits the page without a horizontal scrollbar.
 */
function renderSummary(summaries, ride) {
  els.summaryWrap.hidden = false;

  const gearCell = (side) =>
    `${side.combo.ring}/${side.combo.cog}<br><span class="muted-note">${(side.dev / 1000).toFixed(2)} m · ${fmtSpeed(side.speedKmh, ride.unit)}</span>`;

  const rows = [
    ['Wheel', (s) => `${s.circMm.toFixed(0)} mm`],
    [
      'Gearing',
      (s) =>
        `${s.gearing}${s.isMultiRing ? `<br><span class="muted-note">${MODE_NOTE[s.ringMode]}, ${s.gearCount} gears</span>` : ''}`,
    ],
    ['Total range', (s) => `${s.rangePct.toFixed(0)}%`],
    [
      'Cadence hold',
      (s) => `±${s.holdRpm.toFixed(1)} rpm<br><span class="muted-note">biggest jump ${s.worstStepPct.toFixed(1)}%</span>`,
    ],
    [
      'Coverage',
      (s) =>
        `${(s.coverage.fraction * 100).toFixed(0)}%<br><span class="muted-note">${fmtSpeed(s.coverage.lowKmh, ride.unit)} to ${fmtSpeed(s.coverage.highKmh, ride.unit)}</span>`,
    ],
    ['Easiest gear', (s) => gearCell(s.easiest)],
    ['Hardest gear', (s) => gearCell(s.hardest)],
  ];

  els.summaryThead.innerHTML = `<tr><th></th>${summaries
    .map((s) => `<th>${swatch(s.index)}${esc(s.label)}</th>`)
    .join('')}</tr>`;
  els.summaryTbody.innerHTML = rows
    .map(([label, valueFn]) => `<tr><th scope="row">${label}</th>${summaries.map((s) => `<td>${valueFn(s)}</td>`).join('')}</tr>`)
    .join('');
}

function renderBySpeedTable(series, layout, ride) {
  const headers = {
    single: ['Speed', 'Gear', 'Ratio', 'Cadence', 'vs. target'],
    ring: ['Speed', 'Ring', 'Cog', 'Ratio', 'Cadence', 'vs. target'],
    bike: ['Speed', 'Bike', 'Gear', 'Ratio', 'Cadence', 'vs. target'],
  }[layout];
  els.bySpeedThead.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;

  // Interleave by speed so the bikes (or rings) sit side by side for comparison.
  const rows = [];
  ride.speeds.forEach((_, i) => {
    series.forEach((s, si) => rows.push({ point: s.points[i], label: s.label, seriesIndex: si }));
  });

  els.bySpeedTbody.innerHTML = '';
  for (const { point, label, seriesIndex } of rows) {
    const { best, feel, speedDisplay } = point;
    const tr = document.createElement('tr');
    if (seriesIndex > 0) tr.classList.add('sub-row');

    const cells = [`${speedDisplay.toFixed(1)} ${unitLabel(ride.unit)}`];
    if (layout === 'ring') cells.push(`${swatch(seriesIndex)}${best.ring}T`, `${best.cog}T`);
    else if (layout === 'bike') cells.push(`${swatch(seriesIndex)}${esc(label)}`, `${best.ring}T / ${best.cog}T`);
    else cells.push(`${best.ring}T / ${best.cog}T`);

    cells.push(
      best.ratio.toFixed(2),
      `${best.cadence.toFixed(0)} rpm`,
      `<span class="pill ${feelPillClass(feel.label)}">${feel.label} (${feel.delta >= 0 ? '+' : ''}${feel.delta.toFixed(0)})</span>`
    );
    tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join('');
    els.bySpeedTbody.appendChild(tr);
  }
}

function renderAllGearsTable(groups, ride) {
  els.allGearsTbody.innerHTML = '';
  for (const { label, rows, showHeader } of groups) {
    if (showHeader) {
      const header = document.createElement('tr');
      header.className = 'group-row';
      header.innerHTML = `<td colspan="7">${esc(label)}</td>`;
      els.allGearsTbody.appendChild(header);
    }
    for (const row of rows) {
      const tr = document.createElement('tr');
      if (row.ringShift) tr.classList.add('ring-shift');
      tr.innerHTML = [
        `${row.ring}T / ${row.cog}T${row.ringShift ? ' <span class="muted-note">ring shift</span>' : ''}`,
        row.ratio.toFixed(2),
        `${(row.developmentMm / 1000).toFixed(2)} m`,
        `${row.gearInches.toFixed(1)}"`,
        row.gainRatio.toFixed(2),
        fmtSpeed(row.speedAtPreferredKmh, ride.unit),
        row.jumpPct === null ? '—' : `${row.jumpPct.toFixed(1)}%`,
      ]
        .map((c) => `<td>${c}</td>`)
        .join('');
      els.allGearsTbody.appendChild(tr);
    }
  }
}

const CHART_MAX_W = 720, CHART_MIN_W = 280, CHART_PAD_R = 16;

/**
 * Draw at the container's real pixel width so one SVG unit is one CSS pixel.
 * With a fixed 720-wide viewBox, a 375px phone scaled everything to ~50% and
 * the 9px delta labels rendered under 5px. Re-measured on every render.
 */
function chartMetrics() {
  const measured = els.chart.clientWidth || els.chart.parentElement?.clientWidth || CHART_MAX_W;
  const width = Math.max(CHART_MIN_W, Math.min(CHART_MAX_W, Math.round(measured)));
  const narrow = width < 430;
  return { width, padL: narrow ? 30 : 46, padR: CHART_PAD_R, maxXLabels: narrow ? 5 : 8 };
}

const CHART_STYLE = `
  <style>
    .grid-line { stroke: var(--border); stroke-width: 1; }
    .axis-label { font-size: 10px; fill: var(--muted); font-family: inherit; }
    .axis-title { font-size: 11px; fill: var(--muted); font-family: inherit; }
    .panel-title { font-size: 11px; font-weight: 600; font-family: inherit; }
    .pref-line { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .target-label { font-size: 10px; fill: var(--accent); font-family: inherit; }
    .delta-label { font-size: 9px; font-weight: 600; font-family: inherit; }
    .dot-good, .delta-good { fill: var(--good); }
    .dot-warn, .delta-warn { fill: var(--warn); }
    .dot-bad, .delta-bad { fill: var(--bad); }
    .open-good, .open-warn, .open-bad { fill: var(--panel-bg); stroke-width: 1.6; }
    .open-good { stroke: var(--good); }
    .open-warn { stroke: var(--warn); }
    .open-bad { stroke: var(--bad); }
  </style>`;

/** Signed rpm difference from target: "+4", "-12", "0". */
function deltaLabel(delta) {
  const d = Math.round(delta);
  return d > 0 ? `+${d}` : String(d);
}

/** Shared cadence domain — every panel uses it so bikes stay comparable. */
function cadenceDomain(series, ride) {
  const all = series.flatMap((s) => s.points.map((p) => p.best.cadence));
  // Hold a minimum band around the target so a few rpm of wobble doesn't get
  // stretched into dramatic-looking zigzags; real spin-outs still expand it.
  return {
    minC: Math.min(ride.preferredCadence - 25, ...all),
    maxC: Math.max(ride.preferredCadence + 25, ...all),
  };
}

function xTickMarkup(speeds, xFor, y, maxLabels) {
  const labelEvery = Math.max(1, Math.ceil(speeds.length / maxLabels));
  return speeds
    .map((v, i) =>
      i % labelEvery === 0 || i === speeds.length - 1
        ? `<text x="${xFor(i)}" y="${y}" class="axis-label" text-anchor="middle">${v.toFixed(0)}</text>`
        : ''
    )
    .join('');
}

/**
 * Markers only, no connecting line: each point is an independent "best gear at
 * this speed" decision, and cadence jumps discontinuously as the gear changes,
 * so a line would draw a trajectory the drivetrain never travels.
 */
function plotMarkup(s, ride, xFor, yFor, { dotRadius, labelEvery, plotTop, plotBottom }) {
  // On a multi-ring bike, hollow marks the small ring and solid the big one, so
  // you can see which ring a gear choice sits on without spending the colour.
  const multiRing = s.cfg.rings.length > 1;
  const bigRing = Math.max(...s.cfg.rings);

  let out = '';
  s.points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.best.cadence);
    const cls = feelPillClass(p.feel.label);
    const onSmallRing = multiRing && p.best.ring !== bigRing;
    const ringNote = multiRing ? ` on the ${p.best.ring}T ring` : '';
    const title = `${s.label} @ ${p.speedDisplay.toFixed(1)} ${unitLabel(ride.unit)}: ${p.best.ring}T/${p.best.cog}T, ${p.best.cadence.toFixed(0)} rpm (${deltaLabel(p.feel.delta)})${ringNote}`;
    out += `<circle cx="${x}" cy="${y}" r="${dotRadius}" class="${onSmallRing ? 'open' : 'dot'}-${cls}"><title>${esc(title)}</title></circle>`;
    if (i % labelEvery === 0) {
      // Sit above the marker, flipping below when there's no room up top.
      const fitsAbove = y - dotRadius - 5 > plotTop;
      const ly = fitsAbove ? y - dotRadius - 5 : Math.min(y + dotRadius + 10, plotBottom);
      out += `<text x="${x}" y="${ly}" class="delta-label delta-${cls}" text-anchor="middle">${deltaLabel(p.feel.delta)}</text>`;
    }
  });
  return out;
}

/** One stacked panel per series, sharing a cadence axis and a single x-axis. */
function renderChart(series, ride) {
  const { width: W, padL, padR, maxXLabels } = chartMetrics();
  const padT = 10, gapY = 14, axisH = 34, titleH = 18;
  const panelH = series.length === 1 ? 190 : 132;
  const H = padT + series.length * (panelH + gapY) + axisH;
  const innerW = W - padL - padR;
  const { minC, maxC } = cadenceDomain(series, ride);
  const xFor = (i) => padL + (i / Math.max(1, ride.speeds.length - 1)) * innerW;

  // Thin the labels out rather than letting them collide at fine speed steps.
  const spacing = innerW / Math.max(1, ride.speeds.length - 1);
  const labelEvery = Math.max(1, Math.ceil(26 / spacing));

  let body = '';
  series.forEach((s, si) => {
    const top = padT + si * (panelH + gapY);
    const plotTop = top + titleH;
    const plotBottom = top + panelH;
    const yFor = (c) => plotBottom - ((c - minC) / (maxC - minC)) * (plotBottom - plotTop);

    body += `<text x="${padL}" y="${top + 11}" class="panel-title" fill="${SERIES_COLORS[si % SERIES_COLORS.length]}">${esc(s.label)}</text>`;
    for (const val of [maxC, minC]) {
      const y = yFor(val);
      body += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid-line" />`;
      body += `<text x="${padL - 6}" y="${y + 3}" class="axis-label" text-anchor="end">${val.toFixed(0)}</text>`;
    }
    const prefY = yFor(ride.preferredCadence);
    body += `<line x1="${padL}" y1="${prefY}" x2="${W - padR}" y2="${prefY}" class="pref-line" />`;
    if (si === 0) {
      // On the title row, not against the line — markers crowd the right edge.
      body += `<text x="${W - padR}" y="${top + 11}" class="target-label" text-anchor="end">- - - target ${ride.preferredCadence} rpm</text>`;
    }
    body += plotMarkup(s, ride, xFor, yFor, { dotRadius: 3.5, labelEvery, plotTop, plotBottom });
  });

  const axisY = padT + series.length * (panelH + gapY);
  body += xTickMarkup(ride.speeds, xFor, axisY + 12, maxXLabels);
  body += `<text x="${W / 2}" y="${axisY + 28}" class="axis-title" text-anchor="middle">Speed (${unitLabel(ride.unit)})</text>`;

  els.chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
  els.chart.innerHTML = CHART_STYLE + body;

  const ringKey = series.some((s) => s.cfg.rings.length > 1)
    ? `<span class="legend-item"><span class="dot-key hollow"></span>small ring</span>
       <span class="legend-item"><span class="dot-key solid"></span>big ring</span>`
    : '';

  els.chartLegend.innerHTML = `
    <span class="legend-item"><span class="dot-key good"></span>on target (within 3 rpm)</span>
    <span class="legend-item"><span class="dot-key warn"></span>slightly off</span>
    <span class="legend-item"><span class="dot-key bad"></span>grinding / spun out</span>
    ${ringKey}
    <span class="legend-item legend-note">numbers are rpm above or below your target</span>`;
}

// --- wiring ---

function onBikeFormChange(event) {
  const bike = activeBike();
  const categoryChanged = event?.target === els.categorySelect;
  saveFormToActiveBike();

  if (categoryChanged) {
    // The old ring/cassette indexes mean something different in a new category.
    bike.ringPreset = '0';
    bike.cassettePreset = '0';
    refreshDrivetrainOptions(bike.category);
    els.ringPreset.value = '0';
    els.cassettePreset.value = '0';
  }
  if (event?.target === els.profileFactor) {
    els.profileFactorValue.textContent = parseFloat(els.profileFactor.value).toFixed(2);
  }
  if (event?.target === els.bikeName) renderBikeTabs();

  updateConditionalVisibility();
  updateWheelOutputs();
}

function wireEvents() {
  const bikeEditorInputs = [
    els.bikeName, els.crankLength, els.rimPreset, els.customBsd, els.tirePreset, els.customTire,
    els.profileFactor, els.useOverrideCirc, els.overrideCirc, els.categorySelect, els.ringPreset,
    els.customRings, els.cassettePreset, els.customCogs, els.avoidCrossChain,
  ];
  for (const el of bikeEditorInputs) {
    el.addEventListener('input', onBikeFormChange);
    el.addEventListener('change', onBikeFormChange);
  }
  for (const radio of document.querySelectorAll('input[name="ring-mode"]')) {
    radio.addEventListener('change', () => {
      saveFormToActiveBike();
      updateConditionalVisibility();
    });
  }

  els.addBikeBtn.addEventListener('click', () => {
    if (state.bikes.length >= MAX_BIKES) return;
    saveFormToActiveBike();
    // Clone the current bike so you can change one thing and compare.
    state.bikes.push(createBike(`Bike ${state.bikes.length + 1}`, activeBike()));
    state.activeIndex = state.bikes.length - 1;
    loadBikeIntoForm(activeBike());
    renderBikeTabs();
  });

  els.removeBikeBtn.addEventListener('click', () => {
    if (state.bikes.length < 2) return;
    state.bikes.splice(state.activeIndex, 1);
    state.activeIndex = Math.min(state.activeIndex, state.bikes.length - 1);
    loadBikeIntoForm(activeBike());
    renderBikeTabs();
  });

  els.calculateBtn.addEventListener('click', runCalculation);

  els.speedUnit.addEventListener('change', () => {
    convertSpeedFields(state.speedUnit, els.speedUnit.value);
    state.speedUnit = els.speedUnit.value;
    if (state.lastChart) runCalculation();
  });

  // Geometry is measured at draw time, so a resize or rotate needs a redraw.
  let redrawTimer;
  window.addEventListener('resize', () => {
    if (!state.lastChart) return;
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(() => renderChart(state.lastChart.series, state.lastChart.ride), 150);
  });

  els.tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.tabBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      Object.entries(els.tabContents).forEach(([key, el]) => {
        el.hidden = key !== btn.dataset.tab;
      });
    });
  });
}

function init() {
  initStaticOptions();
  renderSpeedPresets();
  state.speedUnit = els.speedUnit.value;
  loadBikeIntoForm(activeBike());
  renderBikeTabs();
  wireEvents();
}

init();
