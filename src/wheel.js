// Wheel geometry: outer rolling diameter from rim bead-seat diameter (BSD) + tire size.

/**
 * Outer wheel diameter (mm) = rim BSD + 2 * tire section height.
 * Tire section height is approximated as tire width * profileFactor.
 * profileFactor ~1.0 is a reasonable default for road/gravel tires;
 * knobby MTB tires can run slightly taller (~1.0-1.1), slick low-profile
 * tires slightly shorter (~0.9-1.0). Exposed as a tunable in the UI.
 */
export function computeWheelDiameterMm({ bsdMm, tireWidthMm, profileFactor = 1.0 }) {
  return bsdMm + 2 * tireWidthMm * profileFactor;
}

export function circumferenceFromDiameterMm(diameterMm) {
  return diameterMm * Math.PI;
}
