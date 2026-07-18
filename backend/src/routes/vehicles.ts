import { Router } from 'express';
import { query } from '../db/pool.js';

export const vehiclesRouter = Router();

interface BrandRow {
  brand: string;
}

interface ModelRow {
  model: string;
}

interface VariantRow {
  id: number;
  variant: string;
  fuel_type: string;
  transmission: string;
  arai_mileage: string;
  mileage_unit: string;
  model_year_from: number;
  model_year_to: number | null;
  e20_compatible: boolean;
  notes: string | null;
}

// GET /api/brands -> distinct vehicle brands, alphabetical
vehiclesRouter.get('/brands', async (_req, res, next) => {
  try {
    const rows = await query<BrandRow>('SELECT DISTINCT brand FROM vehicles ORDER BY brand');
    res.json(rows.map((row) => row.brand));
  } catch (err) {
    next(err);
  }
});

// GET /api/models?brand= -> distinct models for a brand, alphabetical
vehiclesRouter.get('/models', async (req, res, next) => {
  const brand = req.query.brand;
  if (typeof brand !== 'string' || brand.trim() === '') {
    res.status(400).json({ error: 'query param "brand" is required' });
    return;
  }

  try {
    const rows = await query<ModelRow>(
      'SELECT DISTINCT model FROM vehicles WHERE brand = $1 ORDER BY model',
      [brand],
    );
    res.json(rows.map((row) => row.model));
  } catch (err) {
    next(err);
  }
});

// GET /api/variants?brand=&model= -> variants for a brand+model, with mileage/fuel/transmission details
vehiclesRouter.get('/variants', async (req, res, next) => {
  const { brand, model } = req.query;
  if (typeof brand !== 'string' || brand.trim() === '') {
    res.status(400).json({ error: 'query param "brand" is required' });
    return;
  }
  if (typeof model !== 'string' || model.trim() === '') {
    res.status(400).json({ error: 'query param "model" is required' });
    return;
  }

  try {
    const rows = await query<VariantRow>(
      `SELECT id, variant, fuel_type, transmission, arai_mileage, mileage_unit,
              model_year_from, model_year_to, e20_compatible, notes
       FROM vehicles
       WHERE brand = $1 AND model = $2
       ORDER BY variant`,
      [brand, model],
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        variant: row.variant,
        fuelType: row.fuel_type,
        transmission: row.transmission,
        araiMileage: Number(row.arai_mileage),
        mileageUnit: row.mileage_unit,
        modelYear:
          row.model_year_to != null
            ? `${row.model_year_from}-${row.model_year_to}`
            : `${row.model_year_from}+`,
        e20Compatible: row.e20_compatible,
        notes: row.notes,
      })),
    );
  } catch (err) {
    next(err);
  }
});
