import type { MileageUnit, PriceUnit } from '../types';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

// formats a number as Indian rupees, e.g. ₹1,234.56
export function formatCurrency(amount: number): string {
  return INR.format(amount);
}

// formats a plain number with a fixed decimal count, trimming trailing zeros beyond that
export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

// unit label for a mileage figure: km/l for petrol/diesel/hybrid, km/kg for CNG
export function mileageUnitLabel(unit: MileageUnit): string {
  return unit === 'kmpl' ? 'km/l' : 'km/kg';
}

// unit label for a fuel quantity: litres or kilograms
export function fuelUnitLabel(unit: PriceUnit): string {
  return unit === 'l' ? 'l' : 'kg';
}
