import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ApiError, getBrands, getModels, getVariants } from '../lib/api';
import { formatNumber, mileageUnitLabel } from '../lib/format';
import { estimateRealWorldMileage } from '../lib/mileage';
import type { CustomVehicle, FuelType, MileageUnit, Variant } from '../types';

export type VehicleSelection =
  | { kind: 'catalog'; vehicleId: number; variant: Variant }
  | { kind: 'custom'; vehicle: CustomVehicle };

// sentinel brand value that switches the picker into "not in the database" mode
const OTHER_BRAND = '__other__';

const FUEL_TYPE_OPTIONS: FuelType[] = ['petrol', 'diesel', 'cng', 'hybrid'];

interface VehiclePickerProps {
  value: VehicleSelection | null;
  onChange: (selection: VehicleSelection) => void;
}

// a display-friendly summary of a selection regardless of whether it's a catalog or custom vehicle
function summarize(selection: VehicleSelection): string {
  if (selection.kind === 'catalog') return `${selection.variant.variant} — ${selection.variant.fuelType}`;
  return `${selection.vehicle.label} — ${selection.vehicle.fuelType} (custom)`;
}

// modal flow for picking a vehicle by brand -> model -> variant, with an ARAI/real-world preview;
// hands the final selection back to the parent form on confirm
function VehiclePicker({ value, onChange }: VehiclePickerProps) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [brand, setBrand] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [pendingVariant, setPendingVariant] = useState<Variant | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customLabel, setCustomLabel] = useState('');
  const [customFuelType, setCustomFuelType] = useState<FuelType>('petrol');
  const [customMileage, setCustomMileage] = useState('');
  const [customMileageUnit, setCustomMileageUnit] = useState<MileageUnit>('kmpl');
  const [customE20Compatible, setCustomE20Compatible] = useState(true);

  const [brandsLoading, setBrandsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const isOther = brand === OTHER_BRAND;

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // loads the brand list the first time the modal opens, not on every render
  useEffect(() => {
    if (!open || brands.length > 0) return;
    setBrandsLoading(true);
    getBrands()
      .then(setBrands)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'failed to load brands'),
      )
      .finally(() => setBrandsLoading(false));
  }, [open, brands.length]);

  // resets model/variant state and fetches models whenever the brand changes; "Other" skips the fetch
  useEffect(() => {
    setModel('');
    setModels([]);
    setVariants([]);
    setPendingVariant(null);
    if (!brand || brand === OTHER_BRAND) return;
    setModelsLoading(true);
    getModels(brand)
      .then(setModels)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'failed to load models'),
      )
      .finally(() => setModelsLoading(false));
  }, [brand]);

  // resets variant state and fetches variants whenever the model changes
  useEffect(() => {
    setVariants([]);
    setPendingVariant(null);
    if (!brand || !model) return;
    setVariantsLoading(true);
    getVariants(brand, model)
      .then(setVariants)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'failed to load variants'),
      )
      .finally(() => setVariantsLoading(false));
  }, [brand, model]);

  // moves focus into the dialog as soon as it opens
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // opens the modal, starting the wizard fresh from brand selection
  function openPicker() {
    setError(null);
    setBrand('');
    setCustomLabel('');
    setCustomFuelType('petrol');
    setCustomMileage('');
    setCustomMileageUnit('kmpl');
    setCustomE20Compatible(true);
    setOpen(true);
  }

  // closes the modal and returns focus to the trigger button
  function closePicker() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // stages a variant for confirmation
  function selectVariant(variant: Variant) {
    setError(null);
    setPendingVariant(variant);
  }

  // hands the finished catalog selection to the parent; real-world/E20 adjustment happens after this, in the trip form
  function confirm() {
    if (!pendingVariant) return;
    onChange({ kind: 'catalog', vehicleId: pendingVariant.id, variant: pendingVariant });
    closePicker();
  }

  // validates the custom-vehicle form and hands a synthetic selection to the parent
  function confirmCustom() {
    setError(null);
    const mileage = Number(customMileage);
    if (!customLabel.trim()) {
      setError('enter a name for this vehicle');
      return;
    }
    if (!customMileage || Number.isNaN(mileage) || mileage <= 0) {
      setError('enter a mileage greater than zero');
      return;
    }
    onChange({
      kind: 'custom',
      vehicle: {
        label: customLabel.trim(),
        fuelType: customFuelType,
        araiMileage: mileage,
        mileageUnit: customMileageUnit,
        e20Compatible: customFuelType === 'petrol' ? customE20Compatible : true,
      },
    });
    closePicker();
  }

  // Escape closes the modal; Tab is trapped so focus can't leave the dialog while it's open
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePicker();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select, input, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const list = Array.from(focusable);
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const realWorldEstimate = pendingVariant ? estimateRealWorldMileage(pendingVariant) : null;

  return (
    <div>
      <button type="button" ref={triggerRef} onClick={openPicker} style={triggerStyle}>
        {value ? summarize(value) : 'Select a vehicle'}
      </button>

      {value && value.kind === 'catalog' && (
        <p style={summaryStyle}>
          ARAI: {formatNumber(value.variant.araiMileage, 1)}{' '}
          {mileageUnitLabel(value.variant.mileageUnit)}
          {' · '}
          Est. real-world: {formatNumber(estimateRealWorldMileage(value.variant), 1)}{' '}
          {mileageUnitLabel(value.variant.mileageUnit)}
          {value.variant.notes && <span style={noteHintStyle}> · figures vary by source</span>}
        </p>
      )}

      {value && value.kind === 'custom' && (
        <p style={summaryStyle}>
          Entered mileage: {formatNumber(value.vehicle.araiMileage, 1)}{' '}
          {mileageUnitLabel(value.vehicle.mileageUnit)}
          <span style={noteHintStyle}> · not in the database, no real-world/ARAI comparison</span>
        </p>
      )}

      {open && (
        <div
          style={overlayStyle}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Select a vehicle"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={dialogStyle}
          >
            <h2 style={{ marginTop: 0 }}>Select a vehicle</h2>

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <label style={labelStyle}>
                Brand
                <select
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select brand</option>
                  {brands.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={OTHER_BRAND}>Other — not in the database</option>
                </select>
                {brandsLoading && <span style={hintStyle}>Loading brands…</span>}
              </label>

              {!isOther && (
                <label style={labelStyle}>
                  Model
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    disabled={!brand}
                    style={inputStyle}
                  >
                    <option value="">Select model</option>
                    {models.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {modelsLoading && <span style={hintStyle}>Loading models…</span>}
                  {!modelsLoading && brand && models.length === 0 && (
                    <span style={hintStyle}>No models found for {brand}</span>
                  )}
                </label>
              )}
            </div>

            {isOther && (
              <div style={detailStyle}>
                <label style={labelStyle}>
                  Name
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(event) => setCustomLabel(event.target.value)}
                    placeholder="e.g. my 2015 hatchback"
                    style={inputStyle}
                  />
                </label>

                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <label style={labelStyle}>
                    Fuel type
                    <select
                      value={customFuelType}
                      onChange={(event) => setCustomFuelType(event.target.value as FuelType)}
                      style={inputStyle}
                    >
                      {FUEL_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Mileage
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={customMileage}
                      onChange={(event) => setCustomMileage(event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Unit
                    <select
                      value={customMileageUnit}
                      onChange={(event) => setCustomMileageUnit(event.target.value as MileageUnit)}
                      style={inputStyle}
                    >
                      <option value="kmpl">km/l</option>
                      <option value="kmkg">km/kg</option>
                    </select>
                  </label>
                </div>

                {customFuelType === 'petrol' && (
                  <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={customE20Compatible}
                      onChange={(event) => setCustomE20Compatible(event.target.checked)}
                    />
                    This car is E20-compatible (built after ~April 2023)
                  </label>
                )}

                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Since this vehicle isn't in the database, there's no ARAI figure to compare against —
                  the mileage you enter here is used directly, and the real-world/E20 sliders apply to it
                  after you confirm.
                </p>
              </div>
            )}

            {!isOther && variantsLoading && <p style={hintStyle}>Loading variants…</p>}
            {!isOther && !variantsLoading && brand && model && variants.length === 0 && (
              <p style={hintStyle}>
                No variants found for {brand} {model}
              </p>
            )}
            {!isOther && variants.length > 0 && (
              <ul style={variantListStyle}>
                {variants.map((variant) => (
                  <li key={variant.id}>
                    <button
                      type="button"
                      onClick={() => selectVariant(variant)}
                      style={variantButtonStyle(pendingVariant?.id === variant.id)}
                    >
                      {variant.variant} — {variant.fuelType}, {formatNumber(variant.araiMileage, 1)}{' '}
                      {mileageUnitLabel(variant.mileageUnit)}
                      {variant.notes && (
                        <span style={noteHintStyle}> · figures vary by source</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!isOther && pendingVariant && (
              <div style={detailStyle}>
                <p style={{ margin: 0 }}>
                  ARAI mileage: {formatNumber(pendingVariant.araiMileage, 1)}{' '}
                  {mileageUnitLabel(pendingVariant.mileageUnit)}
                  {' · '}
                  Estimated real-world: {formatNumber(realWorldEstimate ?? 0, 1)}{' '}
                  {mileageUnitLabel(pendingVariant.mileageUnit)}
                </p>
                {pendingVariant.notes && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {pendingVariant.notes}
                  </p>
                )}
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Real-world and E20 assumptions can be fine-tuned after you confirm this vehicle.
                </p>
              </div>
            )}

            {error && <p style={{ color: '#f87171' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closePicker} style={cancelButtonStyle}>
                Cancel
              </button>
              <button
                type="button"
                onClick={isOther ? confirmCustom : confirm}
                disabled={isOther ? !customLabel.trim() || !customMileage : !pendingVariant}
                style={confirmButtonStyle}
              >
                Use this vehicle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const triggerStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '1rem',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
};

const summaryStyle: CSSProperties = {
  margin: 'var(--space-xs) 0 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.85rem',
};

// above Leaflet's own stacking (map panes go up to ~700, its control container to 1000)
// so the modal stays on top of the map in Map mode
const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-md)',
  zIndex: 2000,
};

const dialogStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-lg)',
  width: '100%',
  maxWidth: '520px',
  maxHeight: '80vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
};

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

const hintStyle: CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.8rem',
};

const variantListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  maxHeight: '200px',
  overflowY: 'auto',
};

// button style for a variant row in the list, highlighted when it's the one staged for confirmation
function variantButtonStyle(active: boolean): CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    padding: 'var(--space-sm)',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-bg)' : 'transparent',
    color: 'var(--color-text)',
    cursor: 'pointer',
  };
}

const noteHintStyle: CSSProperties = {
  color: 'var(--color-text-muted)',
  fontStyle: 'italic',
};

const detailStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
};

const cancelButtonStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text)',
  cursor: 'pointer',
};

const confirmButtonStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#fff',
  cursor: 'pointer',
};

export default VehiclePicker;
