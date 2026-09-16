// Core gear-ratio / cadence / speed physics, plus gearing-quality metrics.

export function gearRatio(ringTeeth, cogTeeth) {
  return ringTeeth / cogTeeth;
}

/** Distance travelled per crank revolution, in mm. */
export function developmentMm(circumferenceMm, ratio) {
  return circumferenceMm * ratio;
}

/** km/h from cadence (rpm) and development (mm/crank-rev). */
export function speedKmhFromCadence(cadenceRpm, devMm) {
  return (cadenceRpm * devMm * 60) / 1e6;
}

/** cadence (rpm) required to hold speedKmh with development devMm. */
export function cadenceFromSpeedKmh(speedKmh, devMm) {
  return (speedKmh * 1e6) / 60 / devMm;
}

/** Gain ratio (Sheldon Brown): distance the bike travels per unit the foot travels. */
export function gainRatio(ringTeeth, cogTeeth, wheelDiameterMm, crankLengthMm) {
  const wheelRadiusMm = wheelDiameterMm / 2;
  return (ringTeeth / cogTeeth) * (wheelRadiusMm / crankLengthMm);
}

/** Traditional "gear inches" (effective diameter of an equivalent direct-drive wheel). */
export function gearInches(ringTeeth, cogTeeth, wheelDiameterMm) {
  return (wheelDiameterMm / 25.4) * (ringTeeth / cogTeeth);
}

/**
 * Build every valid ring x cog combination, optionally excluding the most
 * extreme cross-chain pairings (small ring/small cogs, big ring/big cogs)
 * when there's more than one ring.
 */
export function buildCombos(rings, cogs, { avoidCrossChain = true } = {}) {
  const sortedRings = [...rings].sort((a, b) => a - b);
  const sortedCogs = [...cogs].sort((a, b) => a - b);
  const combos = [];
  const excludeN = Math.min(2, sortedCogs.length - 1);
  for (let ri = 0; ri < sortedRings.length; ri++) {
    for (let ci = 0; ci < sortedCogs.length; ci++) {
      if (avoidCrossChain && sortedRings.length > 1 && excludeN > 0) {
        const isBigRing = ri === sortedRings.length - 1;
        const isSmallRing = ri === 0;
        const isBigCogs = ci >= sortedCogs.length - excludeN;
        const isSmallCogs = ci < excludeN;
        if ((isBigRing && isBigCogs) || (isSmallRing && isSmallCogs)) continue;
      }
      combos.push({
        ring: sortedRings[ri],
        ringIndex: ri,
        ringCount: sortedRings.length,
        cog: sortedCogs[ci],
        cogIndex: ci,
        ratio: gearRatio(sortedRings[ri], sortedCogs[ci]),
      });
    }
  }
  return combos;
}

/**
 * For a given target speed, find the combo whose resulting cadence is
 * closest to the preferred cadence. Prefers combos within a physiologically
 * plausible cadence window; falls back to the closest overall if none qualify
 * (which is how "no gear can do this speed" surfaces as an absurd cadence).
 */
export function findBestComboForSpeed({
  speedKmh,
  combos,
  circumferenceMm,
  preferredCadence,
  minPlausibleCadence = 40,
  maxPlausibleCadence = 130,
}) {
  let best = null;
  let bestDelta = Infinity;
  let bestPlausible = false;

  for (const c of combos) {
    const devMm = developmentMm(circumferenceMm, c.ratio);
    const cadence = cadenceFromSpeedKmh(speedKmh, devMm);
    const delta = Math.abs(cadence - preferredCadence);
    const plausible = cadence >= minPlausibleCadence && cadence <= maxPlausibleCadence;

    // A plausible-cadence combo always beats an implausible one.
    if (best && bestPlausible && !plausible) continue;
    if (!best || (plausible && !bestPlausible) || delta < bestDelta) {
      best = { ...c, developmentMm: devMm, cadence };
      bestDelta = delta;
      bestPlausible = plausible;
    }
  }
  return best;
}

/**
 * Full-synchro / sequential ladder: one monotonic run of gears across both rings.
 *
 * Walk the cassette on a ring; at the crossover, shift to the next ring up and
 * simultaneously drop back `compensationCogs` cogs in the same action. That's
 * what Shimano Di2 Full Synchro and SRAM AXS Sequential do (both default to 2
 * cogs), and it turns the ring change into roughly one normal cassette step
 * instead of a lurch. The crossover is chosen so the transition step lands as
 * close as possible to the cassette's own median step.
 */
export function buildSynchroLadder(combos, { compensationCogs = 2 } = {}) {
  const rings = [...new Set(combos.map((c) => c.ring))].sort((a, b) => a - b);
  const cogs = [...new Set(combos.map((c) => c.cog))].sort((a, b) => a - b);
  const sortedByRatio = [...combos].sort((a, b) => a.ratio - b.ratio);
  if (rings.length < 2 || cogs.length < 2) return sortedByRatio;

  const byKey = new Map(combos.map((c) => [`${c.ring}:${c.cog}`, c]));
  const gearAt = (ring, cogIndex) => byKey.get(`${ring}:${cogs[cogIndex]}`);

  const steps = [];
  for (let i = 1; i < cogs.length; i++) steps.push(cogs[i] / cogs[i - 1]);
  steps.sort((a, b) => a - b);
  const medianStep = steps[Math.floor(steps.length / 2)];

  const ladder = [];
  let cogIndex = cogs.length - 1; // largest cog = easiest gear

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const isLast = r === rings.length - 1;
    let stopIndex = 0;

    if (!isLast) {
      const nextRing = rings[r + 1];
      let best = null;
      // Crossover must leave gears on both sides and still step upward.
      for (let k = cogIndex; k >= 0; k--) {
        const landing = k + compensationCogs;
        if (landing > cogs.length - 1) continue;
        if (!gearAt(ring, k) || !gearAt(nextRing, landing)) continue;
        const step = (nextRing * cogs[k]) / (ring * cogs[landing]);
        if (step <= 1) continue;
        const score = Math.abs(Math.log(step) - Math.log(medianStep));
        if (!best || score < best.score) best = { k, landing, score };
      }
      if (!best) continue; // no usable crossover to this ring; skip it
      stopIndex = best.k;
      for (let i = cogIndex; i >= stopIndex; i--) {
        const gear = gearAt(ring, i);
        if (gear) ladder.push(gear);
      }
      cogIndex = best.landing;
      continue;
    }

    for (let i = cogIndex; i >= stopIndex; i--) {
      const gear = gearAt(ring, i);
      if (gear) ladder.push(gear);
    }
  }

  // Safety net: the ladder must never step sideways or backwards.
  const monotonic = ladder.filter((g, i) => i === 0 || g.ratio > ladder[i - 1].ratio);
  return monotonic.length ? monotonic : sortedByRatio;
}

/** Largest step between adjacent gears in an ordered sequence, as a factor. */
export function largestStepFactor(orderedGears) {
  let worst = 1;
  for (let i = 1; i < orderedGears.length; i++) {
    const step = orderedGears[i].ratio / orderedGears[i - 1].ratio;
    if (step > worst) worst = step;
  }
  return worst;
}

/**
 * Peak cadence deviation a ratio step forces on you, assuming you shift at the
 * best moment: cadence swings between T/sqrt(s) and T*sqrt(s) across the step.
 */
export function stepDeviationRpm(stepFactor, targetCadence) {
  return targetCadence * (Math.sqrt(stepFactor) - 1);
}

/**
 * The speed window where some gear can hold the target cadence, and how much of
 * the requested range that covers. Exact — no sampling involved.
 */
export function cadenceCoverage({ gears, circumferenceMm, targetCadence, minSpeedKmh, maxSpeedKmh }) {
  const ratios = gears.map((g) => g.ratio);
  const lowKmh = speedKmhFromCadence(targetCadence, developmentMm(circumferenceMm, Math.min(...ratios)));
  const highKmh = speedKmhFromCadence(targetCadence, developmentMm(circumferenceMm, Math.max(...ratios)));
  const span = maxSpeedKmh - minSpeedKmh;
  if (span <= 0) {
    return { lowKmh, highKmh, fraction: minSpeedKmh >= lowKmh && minSpeedKmh <= highKmh ? 1 : 0 };
  }
  const overlap = Math.max(0, Math.min(highKmh, maxSpeedKmh) - Math.max(lowKmh, minSpeedKmh));
  return { lowKmh, highKmh, fraction: overlap / span };
}

/** How the cadence you'll actually spin compares to what you wanted. */
export function cadenceFeel(actualCadence, preferredCadence) {
  const delta = actualCadence - preferredCadence;
  if (Math.abs(delta) <= 3) return { label: 'On target', delta };
  if (delta < 0) {
    const mag = Math.abs(delta);
    return { label: mag > 12 ? 'Grinding / mashing' : 'Slightly under-geared (low spin)', delta };
  }
  const mag = delta;
  return { label: mag > 12 ? 'Spun out / flailing' : 'Slightly over-geared (fast spin)', delta };
}
