import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../db/pool.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

describe('getPrice', () => {
  beforeEach(() => {
    queryMock.mockReset();
    delete process.env.FUEL_SOURCE;
    delete process.env.FUEL_PRICE_API_KEY;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns the cached row when today's price already exists, without inserting again", async () => {
    queryMock.mockResolvedValueOnce([{ price: '94.72', price_date: '2026-07-18', source: 'mock' }]);
    const { getPrice } = await import('./fuelPrice.js');

    const result = await getPrice('Delhi', 'petrol');

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ price: 94.72, unit: 'l', source: 'mock' });
  });

  it('fetches from the mock provider and writes one cache row on a miss', async () => {
    queryMock.mockResolvedValueOnce([]); // cache miss
    queryMock.mockResolvedValueOnce([]); // insert
    const { getPrice } = await import('./fuelPrice.js');

    const result = await getPrice('Delhi', 'petrol');

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toMatch(/INSERT INTO fuel_prices/);
    expect(result).toMatchObject({ unit: 'l', source: 'mock' });
    if ('unavailable' in result) throw new Error('expected a priced result');
    expect(result.price).toBeGreaterThan(0);
  });

  it('returns an unavailable response for CNG instead of a fake price', async () => {
    queryMock.mockResolvedValueOnce([]); // cache miss
    const { getPrice } = await import('./fuelPrice.js');

    const result = await getPrice('Delhi', 'cng');

    expect(queryMock).toHaveBeenCalledTimes(1); // no insert follows a null fetch
    expect(result).toMatchObject({ unavailable: true });
  });

  it('returns an unavailable response for a city the mock provider has no data for', async () => {
    queryMock.mockResolvedValueOnce([]); // cache miss
    const { getPrice } = await import('./fuelPrice.js');

    const result = await getPrice('Nowhereville', 'petrol');

    expect(result).toMatchObject({ unavailable: true });
  });

  it('throws a clear error when FUEL_SOURCE=live but no API key is configured', async () => {
    process.env.FUEL_SOURCE = 'live';
    queryMock.mockResolvedValueOnce([]); // cache miss
    const { getPrice } = await import('./fuelPrice.js');

    await expect(getPrice('Delhi', 'petrol')).rejects.toThrow(/FUEL_PRICE_API_KEY/);
  });
});
