-- core tables: vehicles (seeded from the scraped dataset), fuel_prices (daily cache), cities (dropdown source)

CREATE TABLE IF NOT EXISTS vehicles (
    id                  SERIAL PRIMARY KEY,
    brand               TEXT NOT NULL,
    model               TEXT NOT NULL,
    variant             TEXT NOT NULL,
    fuel_type           TEXT NOT NULL CHECK (fuel_type IN ('petrol', 'diesel', 'cng', 'hybrid')),
    transmission        TEXT NOT NULL CHECK (transmission IN ('mt', 'at', 'amt', 'cvt', 'dct')),
    arai_mileage        NUMERIC(5,2) NOT NULL CHECK (arai_mileage > 0),
    mileage_unit        TEXT NOT NULL CHECK (mileage_unit IN ('kmpl', 'kmkg')),
    engine_cc           INTEGER,
    model_year_from     INTEGER NOT NULL,
    model_year_to       INTEGER,
    e20_compatible      BOOLEAN NOT NULL,
    tier                SMALLINT NOT NULL CHECK (tier IN (1, 2)),
    notes               TEXT,
    source_url          TEXT NOT NULL,
    scraped_at          DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_vehicle_variant UNIQUE (brand, model, variant, fuel_type, transmission, model_year_from),

    -- CNG mileage is always km/kg, everything else is km/l
    CONSTRAINT chk_unit_matches_fuel CHECK (
        (fuel_type = 'cng' AND mileage_unit = 'kmkg') OR
        (fuel_type != 'cng' AND mileage_unit = 'kmpl')
    ),

    -- catches parse errors from the scrape (e.g. a stray "1200" instead of "12.00")
    CONSTRAINT chk_mileage_range CHECK (
        (mileage_unit = 'kmpl' AND arai_mileage BETWEEN 5 AND 40) OR
        (mileage_unit = 'kmkg' AND arai_mileage BETWEEN 15 AND 40)
    )
);

CREATE INDEX IF NOT EXISTS idx_vehicles_brand_model ON vehicles (brand, model);

CREATE TABLE IF NOT EXISTS cities (
    id      SERIAL PRIMARY KEY,
    name    TEXT NOT NULL,
    state   TEXT NOT NULL,

    CONSTRAINT uq_city_state UNIQUE (name, state)
);

CREATE TABLE IF NOT EXISTS fuel_prices (
    id          SERIAL PRIMARY KEY,
    city        TEXT NOT NULL,
    fuel_type   TEXT NOT NULL CHECK (fuel_type IN ('petrol', 'diesel', 'cng')),
    price       NUMERIC(6,2) NOT NULL CHECK (price > 0),
    price_date  DATE NOT NULL,
    source      TEXT NOT NULL DEFAULT 'mock' CHECK (source IN ('mock', 'live')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_fuel_price_lookup UNIQUE (city, fuel_type, price_date)
);

-- lets an already-created table pick up the source column (CREATE TABLE IF NOT EXISTS won't retrofit it)
ALTER TABLE fuel_prices ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'mock';

-- read-through cache lookup: "do we already have today's price for this city/fuel?"
CREATE INDEX IF NOT EXISTS idx_fuel_prices_lookup ON fuel_prices (city, fuel_type, price_date);
