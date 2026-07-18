export type FuelType = 'petrol' | 'diesel' | 'cng' | 'hybrid';
export type MileageUnit = 'kmpl' | 'kmkg';
export type PriceUnit = 'l' | 'kg';
export type FuelPriceSource = 'mock' | 'live';

export interface City {
  name: string;
  state: string;
}

export interface Variant {
  id: number;
  variant: string;
  fuelType: FuelType;
  transmission: string;
  araiMileage: number;
  mileageUnit: MileageUnit;
  modelYear: string;
  e20Compatible: boolean;
  notes: string | null;
}

export interface FuelPrice {
  price: number;
  unit: PriceUnit;
  date: string;
  source: FuelPriceSource;
}

export interface FuelPriceUnavailable {
  unavailable: true;
  reason: string;
}

export interface CustomVehicle {
  label: string;
  fuelType: FuelType;
  araiMileage: number;
  mileageUnit: MileageUnit;
  e20Compatible: boolean;
}

export interface CalculateTripInput {
  distanceKm: number;
  vehicleId?: number;
  customVehicle?: CustomVehicle;
  city?: string;
  realWorldFactor?: number;
  ethanolFactor?: number;
  pricePerUnit?: number;
}

export interface CalculateTripBreakdown {
  araiMileage: number;
  realWorldFactor: number;
  ethanolFactor: number;
  effectiveMileage: number;
  fuelNeeded: number;
  pricePerUnit: number;
}

export interface CalculateTripResult {
  tripCost: number;
  fuelNeeded: number;
  effectiveMileage: number;
  costPerKm: number;
  unit: MileageUnit;
  breakdown: CalculateTripBreakdown;
  distanceKm: number;
  priceSource: 'manual' | 'mock' | 'live';
  priceDate: string | null;
}

export interface CalculateTripUnavailable {
  priceUnavailable: true;
  reason: string;
}
