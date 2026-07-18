import type { Variant } from '../types';

// mirrors backend/src/lib/calculateTrip.ts's default haircut, kept in sync so the picker can preview honestly
export const DEFAULT_REAL_WORLD_FACTOR = 0.825;

// bounds for the real-world haircut slider — a wide but sane range around the default
export const REAL_WORLD_FACTOR_MIN = 0.6;
export const REAL_WORLD_FACTOR_MAX = 1;

// mirrors backend/src/lib/ethanol.ts's constants — petrol loses mileage to E20 blending, other fuels don't
export const E20_COMPATIBLE_FACTOR = 0.965;
export const E20_INCOMPATIBLE_FACTOR = 0.875;

// bounds for the E20 factor slider — from the older-car default up to no loss at all
export const ETHANOL_FACTOR_MIN = 0.8;
export const ETHANOL_FACTOR_MAX = 1;

// returns the default ethanol mileage multiplier for a variant; 1 for anything that isn't petrol
export function defaultEthanolFactor(variant: Pick<Variant, 'fuelType' | 'e20Compatible'>): number {
  if (variant.fuelType !== 'petrol') return 1;
  return variant.e20Compatible ? E20_COMPATIBLE_FACTOR : E20_INCOMPATIBLE_FACTOR;
}

// combines an ARAI figure with the real-world and ethanol multipliers into an effective mileage
export function effectiveMileage(
  araiMileage: number,
  realWorldFactor: number,
  ethanolFactor: number,
): number {
  return araiMileage * realWorldFactor * ethanolFactor;
}

// estimates real-world mileage from a variant's ARAI figure, using the default factors
export function estimateRealWorldMileage(variant: Variant): number {
  return effectiveMileage(
    variant.araiMileage,
    DEFAULT_REAL_WORLD_FACTOR,
    defaultEthanolFactor(variant),
  );
}
