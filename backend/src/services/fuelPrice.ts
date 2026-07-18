import { query } from '../db/pool.js';

export type PriceableFuelType = 'petrol' | 'diesel' | 'cng';
export type PriceUnit = 'l' | 'kg';
export type FuelPriceSource = 'mock' | 'live';

export interface FuelPriceResult {
  price: number;
  unit: PriceUnit;
  date: string;
  source: FuelPriceSource;
}

export interface FuelPriceUnavailable {
  unavailable: true;
  reason: string;
}

interface FuelPriceRow {
  price: string;
  price_date: string;
  source: FuelPriceSource;
}

const UNIT_FOR_FUEL_TYPE: Record<PriceableFuelType, PriceUnit> = {
  petrol: 'l',
  diesel: 'l',
  cng: 'kg',
};

// mock per-city petrol/diesel prices in INR/litre — clearly fake, for development only, never real pump prices
const MOCK_PETROL_DIESEL: Record<string, { petrol: number; diesel: number }> = {
  Delhi: { petrol: 94.72, diesel: 87.62 },
  Mumbai: { petrol: 103.44, diesel: 89.97 },
  Bengaluru: { petrol: 102.86, diesel: 88.94 },
  Chennai: { petrol: 100.75, diesel: 92.34 },
  Kolkata: { petrol: 103.94, diesel: 90.76 },
  Hyderabad: { petrol: 109.66, diesel: 97.82 },
  Pune: { petrol: 103.44, diesel: 89.97 },
  Ahmedabad: { petrol: 94.49, diesel: 90.17 },
  Jaipur: { petrol: 104.72, diesel: 90.21 },
  Lucknow: { petrol: 94.65, diesel: 87.76 },
};

// today's date in the format fuel_prices.price_date is stored in
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// mock provider: returns a plausible petrol/diesel price; CNG is left unavailable rather than faked
async function fetchMockPrice(city: string, fuelType: PriceableFuelType): Promise<number | null> {
  if (fuelType === 'cng') {
    return null;
  }
  const cityPrices = MOCK_PETROL_DIESEL[city];
  return cityPrices ? cityPrices[fuelType] : null;
}

// live provider: placeholder for a real fuel-price API, gated behind FUEL_SOURCE=live and an API key
async function fetchLivePrice(city: string, fuelType: PriceableFuelType): Promise<number | null> {
  const apiKey = process.env.FUEL_PRICE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'FUEL_SOURCE=live but FUEL_PRICE_API_KEY is not set — add a key in .env or switch FUEL_SOURCE back to mock',
    );
  }
  throw new Error(
    `FUEL_SOURCE=live has no provider wired up yet — add the fetch call for ${fuelType} in ${city} here`,
  );
}

// picks the provider from FUEL_SOURCE and fetches a fresh price, tagging the result with its source
async function fetchFromProvider(
  city: string,
  fuelType: PriceableFuelType,
): Promise<{ price: number; source: FuelPriceSource } | null> {
  const source: FuelPriceSource = process.env.FUEL_SOURCE === 'live' ? 'live' : 'mock';
  const price =
    source === 'live' ? await fetchLivePrice(city, fuelType) : await fetchMockPrice(city, fuelType);
  return price === null ? null : { price, source };
}

// read-through daily cache: returns today's price for (city, fuelType) from fuel_prices, fetching + storing it if missing
export async function getPrice(
  city: string,
  fuelType: PriceableFuelType,
): Promise<FuelPriceResult | FuelPriceUnavailable> {
  const date = today();

  const cached = await query<FuelPriceRow>(
    `SELECT price, price_date, source FROM fuel_prices WHERE city = $1 AND fuel_type = $2 AND price_date = $3`,
    [city, fuelType, date],
  );
  if (cached[0]) {
    return {
      price: Number(cached[0].price),
      unit: UNIT_FOR_FUEL_TYPE[fuelType],
      date,
      source: cached[0].source,
    };
  }

  const fetched = await fetchFromProvider(city, fuelType);
  if (!fetched) {
    return {
      unavailable: true,
      reason: `no ${fuelType} price available for ${city} — enter a price manually`,
    };
  }

  await query(
    `INSERT INTO fuel_prices (city, fuel_type, price, price_date, source)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (city, fuel_type, price_date) DO NOTHING`,
    [city, fuelType, fetched.price, date, fetched.source],
  );

  return {
    price: fetched.price,
    unit: UNIT_FOR_FUEL_TYPE[fuelType],
    date,
    source: fetched.source,
  };
}
