import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool, query } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface VehicleRow {
  brand: string;
  model: string;
  variant: string;
  fuel_type: string;
  transmission: string;
  arai_mileage: number;
  mileage_unit: string;
  engine_cc: number | null;
  model_year_from: number;
  model_year_to: number | null;
  e20_compatible: boolean;
  tier: number;
  notes: string | null;
  source_url: string;
  scraped_at: string | null;
}

const STARTER_CITIES: Array<{ name: string; state: string }> = [
  { name: 'Delhi', state: 'Delhi' },
  { name: 'Mumbai', state: 'Maharashtra' },
  { name: 'Bengaluru', state: 'Karnataka' },
  { name: 'Chennai', state: 'Tamil Nadu' },
  { name: 'Kolkata', state: 'West Bengal' },
  { name: 'Hyderabad', state: 'Telangana' },
  { name: 'Pune', state: 'Maharashtra' },
  { name: 'Ahmedabad', state: 'Gujarat' },
  { name: 'Jaipur', state: 'Rajasthan' },
  { name: 'Lucknow', state: 'Uttar Pradesh' },
];

// applies schema.sql, creating tables if they don't already exist
async function applySchema(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
}

// loads the vehicle dataset into `vehicles`, upserting on the same key the table's unique constraint uses
async function seedVehicles(): Promise<VehicleRow[]> {
  const dataPath = path.join(__dirname, '..', 'data', 'vehicles.json');
  const vehicles: VehicleRow[] = JSON.parse(readFileSync(dataPath, 'utf-8'));

  for (const v of vehicles) {
    const expectedE20 = v.model_year_from >= 2023;
    if (v.e20_compatible !== expectedE20) {
      console.warn(
        `WARNING: ${v.brand} ${v.model} ${v.variant} — e20_compatible=${v.e20_compatible} ` +
          `inconsistent with model_year_from=${v.model_year_from} (expected ${expectedE20})`,
      );
    }

    await query(
      `INSERT INTO vehicles (
         brand, model, variant, fuel_type, transmission, arai_mileage, mileage_unit,
         engine_cc, model_year_from, model_year_to, e20_compatible, tier, notes,
         source_url, scraped_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (brand, model, variant, fuel_type, transmission, model_year_from)
       DO UPDATE SET
         arai_mileage = EXCLUDED.arai_mileage,
         mileage_unit = EXCLUDED.mileage_unit,
         engine_cc = EXCLUDED.engine_cc,
         model_year_to = EXCLUDED.model_year_to,
         e20_compatible = EXCLUDED.e20_compatible,
         tier = EXCLUDED.tier,
         notes = EXCLUDED.notes,
         source_url = EXCLUDED.source_url,
         scraped_at = EXCLUDED.scraped_at`,
      [
        v.brand,
        v.model,
        v.variant,
        v.fuel_type,
        v.transmission,
        v.arai_mileage,
        v.mileage_unit,
        v.engine_cc,
        v.model_year_from,
        v.model_year_to,
        v.e20_compatible,
        v.tier,
        v.notes,
        v.source_url,
        v.scraped_at,
      ],
    );
  }

  return vehicles;
}

// inserts the starter city list, ignoring cities that are already there
async function seedCities(): Promise<void> {
  for (const c of STARTER_CITIES) {
    await query(
      `INSERT INTO cities (name, state) VALUES ($1, $2)
       ON CONFLICT (name, state) DO NOTHING`,
      [c.name, c.state],
    );
  }
}

// prints row counts by brand/fuel_type and asserts mileage data is sane
async function validateSeed(): Promise<void> {
  const byBrand = await query<{ brand: string; count: string }>(
    `SELECT brand, COUNT(*) AS count FROM vehicles GROUP BY brand ORDER BY count DESC`,
  );
  console.log('\nVehicles by brand:');
  byBrand.forEach((r) => console.log(`  ${r.brand.padEnd(20)} ${r.count}`));

  const byFuel = await query<{ fuel_type: string; count: string }>(
    `SELECT fuel_type, COUNT(*) AS count FROM vehicles GROUP BY fuel_type ORDER BY count DESC`,
  );
  console.log('\nVehicles by fuel_type:');
  byFuel.forEach((r) => console.log(`  ${r.fuel_type.padEnd(10)} ${r.count}`));

  const badRows = await query(
    `SELECT id, brand, model, variant FROM vehicles
     WHERE arai_mileage IS NULL
        OR (mileage_unit = 'kmpl' AND arai_mileage NOT BETWEEN 5 AND 40)
        OR (mileage_unit = 'kmkg' AND arai_mileage NOT BETWEEN 15 AND 40)`,
  );
  if (badRows.length > 0) {
    console.error('\nERROR: rows with null or out-of-range arai_mileage:', badRows);
    throw new Error(`${badRows.length} vehicle row(s) failed the mileage sanity check`);
  }

  const cityCount = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM cities`);
  console.log(`\nCities seeded: ${cityCount[0].count}`);
}

async function main(): Promise<void> {
  await applySchema();
  const vehicles = await seedVehicles();
  await seedCities();
  await validateSeed();
  console.log(`\nSeed complete. ${vehicles.length} vehicles processed.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
