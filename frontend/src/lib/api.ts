import type {
  CalculateTripInput,
  CalculateTripResult,
  CalculateTripUnavailable,
  City,
  FuelPrice,
  FuelPriceUnavailable,
  Variant,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {}

// shared request helper: builds the URL, parses JSON, and raises ApiError on non-2xx responses
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError('could not reach the server — check your connection and try again');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.error === 'string' ? body.error : `request failed (${response.status})`;
    throw new ApiError(message);
  }
  return body as T;
}

// fetches the alphabetical list of vehicle brands
export function getBrands(): Promise<string[]> {
  return request<string[]>('/api/brands');
}

// fetches the models for a given brand
export function getModels(brand: string): Promise<string[]> {
  return request<string[]>(`/api/models?brand=${encodeURIComponent(brand)}`);
}

// fetches the variants (with mileage/fuel details) for a given brand + model
export function getVariants(brand: string, model: string): Promise<Variant[]> {
  return request<Variant[]>(
    `/api/variants?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`,
  );
}

// fetches the seeded list of cities supported for fuel pricing
export function getCities(): Promise<City[]> {
  return request<City[]>('/api/cities');
}

// fetches today's cached fuel price for a city + fuel type, or an "unavailable" result
export function getFuelPrice(
  city: string,
  fuelType: 'petrol' | 'diesel' | 'cng',
): Promise<FuelPrice | FuelPriceUnavailable> {
  return request<FuelPrice | FuelPriceUnavailable>(
    `/api/fuel-price?city=${encodeURIComponent(city)}&fuelType=${fuelType}`,
  );
}

// runs the trip calculation for a vehicle + distance, pricing fuel by city or a manual override
export function calculateTrip(
  input: CalculateTripInput,
): Promise<CalculateTripResult | CalculateTripUnavailable> {
  return request<CalculateTripResult | CalculateTripUnavailable>('/api/calculate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
