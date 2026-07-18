export type FuelType = 'petrol' | 'diesel' | 'cng' | 'hybrid';

// India has run ~E20 petrol nationwide since April 2023; older engines lose more efficiency to it
const E20_COMPATIBLE_FACTOR = 0.965;
const E20_INCOMPATIBLE_FACTOR = 0.875;
const NO_ETHANOL_LOSS_FACTOR = 1;

// returns the mileage multiplier from ethanol-blended petrol; 1 for fuels E20 doesn't touch
export function getEthanolFactor(fuelType: FuelType, e20Compatible: boolean): number {
  if (fuelType !== 'petrol') {
    return NO_ETHANOL_LOSS_FACTOR;
  }
  return e20Compatible ? E20_COMPATIBLE_FACTOR : E20_INCOMPATIBLE_FACTOR;
}
