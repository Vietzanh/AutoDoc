/**
 * Measurement unit conversion utilities for the Crop tool.
 *
 * All PDF internal coordinates are in **points** (1 pt = 1/72 inch).
 * The frontend stores margin values in the user's chosen display unit
 * and converts to points before sending to the backend or computing
 * overlay percentages.
 */

export type MeasurementUnit = "pt" | "pc" | "mm" | "cm" | "in";

export interface UnitOption {
  value: MeasurementUnit;
  label: string;
}

export const UNIT_OPTIONS: UnitOption[] = [
  { value: "pt", label: "Points" },
  { value: "pc", label: "Picas" },
  { value: "mm", label: "Millimeters" },
  { value: "cm", label: "Centimeters" },
  { value: "in", label: "Inches" },
];

/** How many points one unit equals. */
const PTS_PER_UNIT: Record<MeasurementUnit, number> = {
  pt: 1,
  pc: 12,
  mm: 72 / 25.4,   // ≈ 2.8346
  cm: 72 / 2.54,    // ≈ 28.3465
  in: 72,
};

/** Convert a value from the given unit to points. */
export function toPoints(value: number, unit: MeasurementUnit): number {
  return value * PTS_PER_UNIT[unit];
}

/** Convert a value from points to the given unit. */
export function fromPoints(pts: number, unit: MeasurementUnit): number {
  return pts / PTS_PER_UNIT[unit];
}

/**
 * Convert a margin value from one unit to another, rounding to avoid
 * floating-point noise in the UI.
 */
export function convertUnit(
  value: number,
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit,
  decimals = 4,
): number {
  if (fromUnit === toUnit) return value;
  const pts = toPoints(value, fromUnit);
  return parseFloat(fromPoints(pts, toUnit).toFixed(decimals));
}
