import { Router } from 'express';
import { query } from '../db/pool.js';
import { getPrice, type PriceableFuelType } from '../services/fuelPrice.js';

export const fuelRouter = Router();

interface CityRow {
  name: string;
  state: string;
}

const PRICEABLE_FUEL_TYPES = ['petrol', 'diesel', 'cng'];

// GET /api/cities -> seeded cities, alphabetical
fuelRouter.get('/cities', async (_req, res, next) => {
  try {
    const rows = await query<CityRow>('SELECT name, state FROM cities ORDER BY name');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/fuel-price?city=&fuelType= -> today's cached/fetched price, or an "unavailable" response (e.g. CNG gaps)
fuelRouter.get('/fuel-price', async (req, res, next) => {
  const { city, fuelType } = req.query;

  if (typeof city !== 'string' || city.trim() === '') {
    res.status(400).json({ error: 'query param "city" is required' });
    return;
  }
  if (typeof fuelType !== 'string' || !PRICEABLE_FUEL_TYPES.includes(fuelType)) {
    res.status(400).json({ error: 'query param "fuelType" must be one of petrol, diesel, cng' });
    return;
  }

  try {
    const result = await getPrice(city, fuelType as PriceableFuelType);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
