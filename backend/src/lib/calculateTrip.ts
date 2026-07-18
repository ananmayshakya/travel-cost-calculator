import { getEthanolFactor, type FuelType } from './ethanol.js';

export type MileageUnit = 'kmpl' | 'kmkg';

// ARAI figures are lab-optimistic; this is the default real-world haircut, user-adjustable
export const DEFAULT_REAL_WORLD_FACTOR = 0.825;

export interface CalculateTripInput {
  distanceKm: number;
  araiMileage: number;
  mileageUnit: MileageUnit;
  fuelType: FuelType;
  e20Compatible: boolean;
  pricePerUnit: number;
  realWorldFactor?: number;
  ethanolFactor?: number;
}

export interface CalculateTripResult {
  tripCost: number;
  fuelNeeded: number;
  effectiveMileage: number;
  costPerKm: number;
  unit: MileageUnit;
  breakdown: {
    araiMileage: number;
    realWorldFactor: number;
    ethanolFactor: number;
    effectiveMileage: number;
    fuelNeeded: number;
    pricePerUnit: number;
  };
}

// runs the full trip-cost pipeline: ARAI mileage -> real-world/ethanol adjustment -> fuel needed -> cost
export function calculateTrip(input: CalculateTripInput): CalculateTripResult {
  const {
    distanceKm,
    araiMileage,
    mileageUnit,
    fuelType,
    e20Compatible,
    pricePerUnit,
    realWorldFactor = DEFAULT_REAL_WORLD_FACTOR,
    ethanolFactor = getEthanolFactor(fuelType, e20Compatible),
  } = input;

  if (distanceKm <= 0) {
    throw new Error('distanceKm must be a positive number');
  }
  if (araiMileage <= 0) {
    throw new Error('araiMileage must be a positive number');
  }
  if (pricePerUnit <= 0) {
    throw new Error('pricePerUnit must be a positive number');
  }
  if (realWorldFactor <= 0 || realWorldFactor > 1) {
    throw new Error('realWorldFactor must be between 0 (exclusive) and 1');
  }
  if (ethanolFactor <= 0 || ethanolFactor > 1) {
    throw new Error('ethanolFactor must be between 0 (exclusive) and 1');
  }

  const effectiveMileage = araiMileage * realWorldFactor * ethanolFactor;
  const fuelNeeded = distanceKm / effectiveMileage;
  const tripCost = fuelNeeded * pricePerUnit;
  const costPerKm = tripCost / distanceKm;

  return {
    tripCost,
    fuelNeeded,
    effectiveMileage,
    costPerKm,
    unit: mileageUnit,
    breakdown: {
      araiMileage,
      realWorldFactor,
      ethanolFactor,
      effectiveMileage,
      fuelNeeded,
      pricePerUnit,
    },
  };
}
