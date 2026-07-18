import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { ApiError, calculateTrip, getCities } from '../lib/api';
import { formatNumber, mileageUnitLabel } from '../lib/format';
import {
  DEFAULT_REAL_WORLD_FACTOR,
  ETHANOL_FACTOR_MAX,
  ETHANOL_FACTOR_MIN,
  REAL_WORLD_FACTOR_MAX,
  REAL_WORLD_FACTOR_MIN,
  defaultEthanolFactor,
  effectiveMileage,
} from '../lib/mileage';
import type { CalculateTripResult, City } from '../types';
import type { Mode } from './ModeToggle';
import MapRoute from './MapRoute';
import VehiclePicker, { type VehicleSelection } from './VehiclePicker';

interface TripFormProps {
  mode: Mode;
  onResult: (result: CalculateTripResult | null) => void;
}

// how long to wait after a slider stops moving before re-running the calculation
const ADJUSTMENT_DEBOUNCE_MS = 300;

// trip form shared by both entry modes: a distance (typed manually or resolved from a map route),
// the vehicle picker, city, adjustable real-world/E20 factors, and submit to /api/calculate. Only the
// distance source changes with mode — vehicle selection, city, and the calc pipeline are identical either way.
function TripForm({ mode, onResult }: TripFormProps) {
  const [manualDistance, setManualDistance] = useState('');
  const [mapDistanceKm, setMapDistanceKm] = useState<number | null>(null);

  const [selection, setSelection] = useState<VehicleSelection | null>(null);
  const [realWorldFactor, setRealWorldFactor] = useState(DEFAULT_REAL_WORLD_FACTOR);
  const [ethanolFactor, setEthanolFactor] = useState(1);

  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [city, setCity] = useState('');

  const [priceUnavailable, setPriceUnavailable] = useState<string | null>(null);
  const [manualPrice, setManualPrice] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculateTripResult | null>(null);

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'failed to load cities'),
      )
      .finally(() => setCitiesLoading(false));
  }, []);

  // a unified vehicle spec regardless of whether the selection is a catalog variant or a custom entry
  const vehicleSpec =
    selection === null
      ? null
      : selection.kind === 'catalog'
        ? {
            araiMileage: selection.variant.araiMileage,
            mileageUnit: selection.variant.mileageUnit,
            fuelType: selection.variant.fuelType,
            e20Compatible: selection.variant.e20Compatible,
          }
        : selection.vehicle;

  // resets the adjustment sliders to this vehicle's defaults whenever a new one is picked
  useEffect(() => {
    if (!vehicleSpec) return;
    setRealWorldFactor(DEFAULT_REAL_WORLD_FACTOR);
    setEthanolFactor(defaultEthanolFactor(vehicleSpec));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const distance = mode === 'manual' ? Number(manualDistance) : mapDistanceKm;
  const isPetrol = vehicleSpec?.fuelType === 'petrol';

  // MapRoute calls this on every render pass through its effect; useCallback keeps it referentially
  // stable so that effect doesn't refire every time this form re-renders
  const handleMapDistance = useCallback((km: number | null) => setMapDistanceKm(km), []);

  // runs the calculation against the current form state; shared by the submit button and the
  // debounced auto-recalculation that fires when the adjustment sliders move after a result exists
  const runCalculation = useCallback(async () => {
    setError(null);

    if (distance === null || Number.isNaN(distance) || distance <= 0) {
      setError(
        mode === 'manual'
          ? 'enter a distance greater than zero'
          : 'search a from and to location to get a route',
      );
      return;
    }
    if (!selection) {
      setError('select a vehicle');
      return;
    }
    const price = manualPrice ? Number(manualPrice) : undefined;
    if (!priceUnavailable && !city) {
      setError('select a city');
      return;
    }
    if (priceUnavailable && (!manualPrice || Number.isNaN(price) || (price ?? 0) <= 0)) {
      setError('enter a manual fuel price to continue');
      return;
    }

    setLoading(true);
    try {
      const calcResult = await calculateTrip({
        distanceKm: distance,
        vehicleId: selection.kind === 'catalog' ? selection.vehicleId : undefined,
        customVehicle: selection.kind === 'custom' ? selection.vehicle : undefined,
        city: priceUnavailable ? undefined : city,
        pricePerUnit: priceUnavailable ? price : undefined,
        realWorldFactor,
        ethanolFactor: isPetrol ? ethanolFactor : undefined,
      });
      if ('priceUnavailable' in calcResult) {
        setPriceUnavailable(calcResult.reason);
        setResult(null);
        onResult(null);
      } else {
        setPriceUnavailable(null);
        setResult(calcResult);
        onResult(calcResult);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'something went wrong calculating the trip');
    } finally {
      setLoading(false);
    }
  }, [
    distance,
    mode,
    selection,
    manualPrice,
    priceUnavailable,
    city,
    realWorldFactor,
    ethanolFactor,
    isPetrol,
    onResult,
  ]);

  // once a result is showing, moving a slider re-runs the calculation after a short debounce —
  // this is what makes the adjustments feel "live" without spamming the API on every drag frame.
  // deliberately scoped to just the two sliders: other field changes (city, distance, ...) still
  // require an explicit submit, so the form doesn't recalculate mid-edit
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      void runCalculation();
    }, ADJUSTMENT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realWorldFactor, ethanolFactor]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await runCalculation();
  }

  const previewMileage = vehicleSpec
    ? effectiveMileage(vehicleSpec.araiMileage, realWorldFactor, isPetrol ? ethanolFactor : 1)
    : null;
  const baseMileageLabel = selection?.kind === 'custom' ? 'Entered mileage' : 'ARAI';

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      {mode === 'manual' ? (
        <label style={labelStyle}>
          Distance (km)
          <input
            type="number"
            min="0"
            step="0.1"
            value={manualDistance}
            onChange={(event) => setManualDistance(event.target.value)}
            style={inputStyle}
          />
        </label>
      ) : (
        <MapRoute onDistanceChange={handleMapDistance} />
      )}

      <div style={labelStyle}>
        Vehicle
        <VehiclePicker value={selection} onChange={setSelection} />
      </div>

      {vehicleSpec && (
        <div style={adjustPanelStyle}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {baseMileageLabel}: {formatNumber(vehicleSpec.araiMileage, 1)}{' '}
            {mileageUnitLabel(vehicleSpec.mileageUnit)}
            {' → '}
            Effective: {formatNumber(previewMileage ?? 0, 1)}{' '}
            {mileageUnitLabel(vehicleSpec.mileageUnit)}
          </p>

          <label style={labelStyle}>
            Real-world estimate ({Math.round(realWorldFactor * 100)}% of ARAI)
            <input
              type="range"
              min={REAL_WORLD_FACTOR_MIN}
              max={REAL_WORLD_FACTOR_MAX}
              step={0.01}
              value={realWorldFactor}
              onChange={(event) => setRealWorldFactor(Number(event.target.value))}
              aria-label="Real-world mileage haircut from ARAI"
            />
          </label>

          {isPetrol && (
            <label style={labelStyle}>
              E20 ethanol adjustment ({Math.round(ethanolFactor * 100)}% of non-ethanol mileage)
              <input
                type="range"
                min={ETHANOL_FACTOR_MIN}
                max={ETHANOL_FACTOR_MAX}
                step={0.01}
                value={ethanolFactor}
                onChange={(event) => setEthanolFactor(Number(event.target.value))}
                aria-label="E20 ethanol mileage adjustment"
              />
              <span style={{ fontSize: '0.8rem' }}>
                Assumes{' '}
                {vehicleSpec.e20Compatible
                  ? 'this car is E20-compatible'
                  : 'this older car loses more mileage to E20'}{' '}
                — drag to use your own figure.
              </span>
            </label>
          )}
        </div>
      )}

      <label style={labelStyle}>
        City
        {citiesLoading ? (
          <span style={{ fontSize: '0.85rem' }}>Loading cities…</span>
        ) : (
          <select
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
              setPriceUnavailable(null);
            }}
            style={inputStyle}
          >
            <option value="">Select city</option>
            {cities.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}, {option.state}
              </option>
            ))}
          </select>
        )}
      </label>

      {priceUnavailable && (
        <div style={{ color: 'var(--color-text-muted)' }}>
          <p>{priceUnavailable}</p>
          <label style={labelStyle}>
            Manual price per {vehicleSpec?.fuelType === 'cng' ? 'kg' : 'litre'} (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={manualPrice}
              onChange={(event) => setManualPrice(event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      )}

      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      <button type="submit" disabled={loading} style={submitStyle}>
        {loading ? 'Calculating…' : 'Calculate cost'}
      </button>
    </form>
  );
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  flex: 1,
  color: 'var(--color-text-muted)',
  fontSize: '0.85rem',
};

const inputStyle: CSSProperties = {
  padding: 'var(--space-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '1rem',
};

const submitStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#fff',
  fontSize: '1rem',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const adjustPanelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm) var(--space-md)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
};

export default TripForm;
