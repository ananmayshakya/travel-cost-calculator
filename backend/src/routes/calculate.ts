import { Router } from 'express';
import { query } from '../db/pool.js';
import { calculateTrip, type MileageUnit } from '../lib/calculateTrip.js';
import type { FuelType } from '../lib/ethanol.js';
import { getPrice, type PriceableFuelType } from '../services/fuelPrice.js';

export const calculateRouter = Router();

interface VehicleRow {
  arai_mileage: string;
  mileage_unit: MileageUnit;
  fuel_type: FuelType;
  e20_compatible: boolean;
}

interface CustomVehicle {
  araiMileage: number;
  mileageUnit: MileageUnit;
  fuelType: FuelType;
  e20Compatible: boolean;
}

const MILEAGE_UNITS: MileageUnit[] = ['kmpl', 'kmkg'];
const FUEL_TYPES: FuelType[] = ['petrol', 'diesel', 'cng', 'hybrid'];

// hybrids are priced at the pump as petrol — fuel_prices only tracks petrol/diesel/cng
function priceableFuelType(fuelType: FuelType): PriceableFuelType {
  return fuelType === 'hybrid' ? 'petrol' : fuelType;
}

// checks a client-supplied customVehicle object has the shape calculateTrip needs; returns an error message or null
function validateCustomVehicle(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return '"customVehicle" must be an object';
  const v = value as Record<string, unknown>;
  if (typeof v.araiMileage !== 'number' || v.araiMileage <= 0) {
    return '"customVehicle.araiMileage" must be a positive number';
  }
  if (typeof v.mileageUnit !== 'string' || !MILEAGE_UNITS.includes(v.mileageUnit as MileageUnit)) {
    return `"customVehicle.mileageUnit" must be one of ${MILEAGE_UNITS.join(', ')}`;
  }
  if (typeof v.fuelType !== 'string' || !FUEL_TYPES.includes(v.fuelType as FuelType)) {
    return `"customVehicle.fuelType" must be one of ${FUEL_TYPES.join(', ')}`;
  }
  if (typeof v.e20Compatible !== 'boolean') {
    return '"customVehicle.e20Compatible" must be a boolean';
  }
  return null;
}

// POST /api/calculate -> runs calculateTrip for a seeded vehicle (by vehicleId) or a user-entered
// vehicle not in the database (by customVehicle), pricing fuel from the city cache or a manual override
calculateRouter.post('/calculate', async (req, res, next) => {
  const { distanceKm, vehicleId, customVehicle, city, realWorldFactor, ethanolFactor, pricePerUnit } =
    req.body as Record<string, unknown>;

  if (typeof distanceKm !== 'number' || distanceKm <= 0) {
    res.status(400).json({ error: '"distanceKm" must be a positive number' });
    return;
  }
  if (vehicleId === undefined && customVehicle === undefined) {
    res.status(400).json({ error: 'either "vehicleId" or "customVehicle" is required' });
    return;
  }
  if (vehicleId !== undefined && customVehicle !== undefined) {
    res.status(400).json({ error: 'provide either "vehicleId" or "customVehicle", not both' });
    return;
  }
  if (vehicleId !== undefined && (typeof vehicleId !== 'number' || !Number.isInteger(vehicleId))) {
    res.status(400).json({ error: '"vehicleId" must be an integer' });
    return;
  }
  if (customVehicle !== undefined) {
    const customError = validateCustomVehicle(customVehicle);
    if (customError) {
      res.status(400).json({ error: customError });
      return;
    }
  }
  if (pricePerUnit === undefined && (typeof city !== 'string' || city.trim() === '')) {
    res.status(400).json({ error: '"city" is required unless "pricePerUnit" is given manually' });
    return;
  }
  if (pricePerUnit !== undefined && (typeof pricePerUnit !== 'number' || pricePerUnit <= 0)) {
    res.status(400).json({ error: '"pricePerUnit" must be a positive number if provided' });
    return;
  }
  if (realWorldFactor !== undefined && typeof realWorldFactor !== 'number') {
    res.status(400).json({ error: '"realWorldFactor" must be a number if provided' });
    return;
  }
  if (ethanolFactor !== undefined && typeof ethanolFactor !== 'number') {
    res.status(400).json({ error: '"ethanolFactor" must be a number if provided' });
    return;
  }

  try {
    let vehicle: CustomVehicle;
    if (customVehicle !== undefined) {
      vehicle = customVehicle as CustomVehicle;
    } else {
      const rows = await query<VehicleRow>(
        'SELECT arai_mileage, mileage_unit, fuel_type, e20_compatible FROM vehicles WHERE id = $1',
        [vehicleId],
      );
      const row = rows[0];
      if (!row) {
        res.status(404).json({ error: `no vehicle found with id ${vehicleId}` });
        return;
      }
      vehicle = {
        araiMileage: Number(row.arai_mileage),
        mileageUnit: row.mileage_unit,
        fuelType: row.fuel_type,
        e20Compatible: row.e20_compatible,
      };
    }

    let resolvedPrice: number;
    let priceSource: 'manual' | 'mock' | 'live';
    let priceDate: string | null = null;

    if (typeof pricePerUnit === 'number') {
      resolvedPrice = pricePerUnit;
      priceSource = 'manual';
    } else {
      const priceResult = await getPrice(city as string, priceableFuelType(vehicle.fuelType));
      if ('unavailable' in priceResult) {
        res.status(200).json({ priceUnavailable: true, reason: priceResult.reason });
        return;
      }
      resolvedPrice = priceResult.price;
      priceSource = priceResult.source;
      priceDate = priceResult.date;
    }

    const result = calculateTrip({
      distanceKm,
      araiMileage: vehicle.araiMileage,
      mileageUnit: vehicle.mileageUnit,
      fuelType: vehicle.fuelType,
      e20Compatible: vehicle.e20Compatible,
      pricePerUnit: resolvedPrice,
      realWorldFactor,
      ethanolFactor,
    });

    res.json({ ...result, distanceKm, priceSource, priceDate });
  } catch (err) {
    next(err);
  }
});
