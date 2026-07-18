import { describe, expect, it } from 'vitest';
import { getEthanolFactor } from './ethanol.js';

describe('getEthanolFactor', () => {
  it('applies the compatible-car factor for E20-compatible petrol', () => {
    expect(getEthanolFactor('petrol', true)).toBeCloseTo(0.965);
  });

  it('applies a larger loss for older, non-compatible petrol cars', () => {
    const olderFactor = getEthanolFactor('petrol', false);
    const newerFactor = getEthanolFactor('petrol', true);
    expect(olderFactor).toBeLessThan(newerFactor);
    expect(olderFactor).toBeCloseTo(0.875);
  });

  it('is unaffected for diesel', () => {
    expect(getEthanolFactor('diesel', true)).toBe(1);
    expect(getEthanolFactor('diesel', false)).toBe(1);
  });

  it('is unaffected for CNG', () => {
    expect(getEthanolFactor('cng', true)).toBe(1);
  });

  it('is unaffected for hybrid', () => {
    expect(getEthanolFactor('hybrid', true)).toBe(1);
  });
});
