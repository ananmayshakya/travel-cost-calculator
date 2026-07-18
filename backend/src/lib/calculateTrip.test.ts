import { describe, expect, it } from 'vitest';
import { calculateTrip, DEFAULT_REAL_WORLD_FACTOR } from './calculateTrip.js';

describe('calculateTrip', () => {
  it('applies the E20-compatible ethanol factor for a newer petrol car', () => {
    const result = calculateTrip({
      distanceKm: 300,
      araiMileage: 20,
      mileageUnit: 'kmpl',
      fuelType: 'petrol',
      e20Compatible: true,
      pricePerUnit: 105,
    });

    const expectedEffectiveMileage = 20 * DEFAULT_REAL_WORLD_FACTOR * 0.965;
    expect(result.effectiveMileage).toBeCloseTo(expectedEffectiveMileage);
    expect(result.fuelNeeded).toBeCloseTo(300 / expectedEffectiveMileage);
    expect(result.tripCost).toBeCloseTo(result.fuelNeeded * 105);
    expect(result.costPerKm).toBeCloseTo(result.tripCost / 300);
    expect(result.unit).toBe('kmpl');
  });

  it('gives an older, non-E20-compatible petrol car a worse effective mileage than a newer one', () => {
    const base = {
      distanceKm: 300,
      araiMileage: 20,
      mileageUnit: 'kmpl' as const,
      fuelType: 'petrol' as const,
      pricePerUnit: 105,
    };

    const newer = calculateTrip({ ...base, e20Compatible: true });
    const older = calculateTrip({ ...base, e20Compatible: false });

    expect(older.effectiveMileage).toBeLessThan(newer.effectiveMileage);
    expect(older.tripCost).toBeGreaterThan(newer.tripCost);
  });

  it('skips the ethanol factor entirely for diesel', () => {
    const result = calculateTrip({
      distanceKm: 300,
      araiMileage: 22,
      mileageUnit: 'kmpl',
      fuelType: 'diesel',
      e20Compatible: false,
      pricePerUnit: 92,
    });

    expect(result.breakdown.ethanolFactor).toBe(1);
    expect(result.effectiveMileage).toBeCloseTo(22 * DEFAULT_REAL_WORLD_FACTOR);
  });

  it('computes CNG trips in km/kg against a per-kg price, not per-litre', () => {
    const result = calculateTrip({
      distanceKm: 300,
      araiMileage: 30,
      mileageUnit: 'kmkg',
      fuelType: 'cng',
      e20Compatible: false,
      pricePerUnit: 75,
    });

    const expectedEffectiveMileage = 30 * DEFAULT_REAL_WORLD_FACTOR;
    expect(result.unit).toBe('kmkg');
    expect(result.effectiveMileage).toBeCloseTo(expectedEffectiveMileage);
    expect(result.fuelNeeded).toBeCloseTo(300 / expectedEffectiveMileage);
    expect(result.tripCost).toBeCloseTo(result.fuelNeeded * 75);
  });

  it('applies a custom real-world factor when one is passed in', () => {
    const result = calculateTrip({
      distanceKm: 100,
      araiMileage: 20,
      mileageUnit: 'kmpl',
      fuelType: 'diesel',
      e20Compatible: false,
      pricePerUnit: 92,
      realWorldFactor: 0.9,
    });

    expect(result.breakdown.realWorldFactor).toBe(0.9);
    expect(result.effectiveMileage).toBeCloseTo(18);
  });

  it('applies a custom ethanol factor when one is passed in, overriding the e20Compatible default', () => {
    const result = calculateTrip({
      distanceKm: 100,
      araiMileage: 20,
      mileageUnit: 'kmpl',
      fuelType: 'petrol',
      e20Compatible: true,
      pricePerUnit: 105,
      ethanolFactor: 0.9,
    });

    expect(result.breakdown.ethanolFactor).toBe(0.9);
    expect(result.effectiveMileage).toBeCloseTo(20 * DEFAULT_REAL_WORLD_FACTOR * 0.9);
  });

  it('rejects an ethanol factor outside (0, 1]', () => {
    expect(() =>
      calculateTrip({
        distanceKm: 100,
        araiMileage: 20,
        mileageUnit: 'kmpl',
        fuelType: 'petrol',
        e20Compatible: true,
        pricePerUnit: 105,
        ethanolFactor: 0,
      }),
    ).toThrow(/ethanolFactor/);
  });

  it('rejects a non-positive distance', () => {
    expect(() =>
      calculateTrip({
        distanceKm: 0,
        araiMileage: 20,
        mileageUnit: 'kmpl',
        fuelType: 'petrol',
        e20Compatible: true,
        pricePerUnit: 105,
      }),
    ).toThrow(/distanceKm/);
  });

  it('rejects a non-positive ARAI mileage', () => {
    expect(() =>
      calculateTrip({
        distanceKm: 100,
        araiMileage: -5,
        mileageUnit: 'kmpl',
        fuelType: 'petrol',
        e20Compatible: true,
        pricePerUnit: 105,
      }),
    ).toThrow(/araiMileage/);
  });

  it('rejects a non-positive fuel price', () => {
    expect(() =>
      calculateTrip({
        distanceKm: 100,
        araiMileage: 20,
        mileageUnit: 'kmpl',
        fuelType: 'petrol',
        e20Compatible: true,
        pricePerUnit: 0,
      }),
    ).toThrow(/pricePerUnit/);
  });

  it('rejects a real-world factor outside (0, 1]', () => {
    expect(() =>
      calculateTrip({
        distanceKm: 100,
        araiMileage: 20,
        mileageUnit: 'kmpl',
        fuelType: 'petrol',
        e20Compatible: true,
        pricePerUnit: 105,
        realWorldFactor: 1.2,
      }),
    ).toThrow(/realWorldFactor/);
  });
});
