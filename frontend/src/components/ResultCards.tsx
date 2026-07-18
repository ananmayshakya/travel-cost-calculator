import { useEffect, useRef, useState } from 'react';
import type { CalculateTripResult } from '../types';
import { formatCurrency, formatNumber, mileageUnitLabel } from '../lib/format';

const ROLL_UP_DURATION_MS = 700;

interface ResultCardsProps {
  result: CalculateTripResult;
}

// displays the outcome of a trip calculation: distance, total cost, and a full breakdown of how the
// effective mileage and price were derived
function ResultCards({ result }: ResultCardsProps) {
  const unit = mileageUnitLabel(result.unit);
  const fuelUnit = result.unit === 'kmpl' ? 'l' : 'kg';
  const derivation = `${formatNumber(result.breakdown.araiMileage, 1)} ARAI × ${Math.round(
    result.breakdown.realWorldFactor * 100,
  )}% real-world × ${Math.round(result.breakdown.ethanolFactor * 100)}% E20`;
  const priceLabel =
    result.priceSource === 'manual'
      ? 'entered manually'
      : `${result.priceDate ?? 'today'} · ${result.priceSource} price`;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--space-md)',
      }}
    >
      <Card label="Trip cost" value={formatCurrency} target={result.tripCost} big />
      <Card label="Distance" value={(v) => `${formatNumber(v, 1)} km`} target={result.distanceKm} />
      <Card label="Cost per km" value={formatCurrency} target={result.costPerKm} />
      <Card
        label="Fuel needed"
        value={(v) => `${formatNumber(v)} ${fuelUnit}`}
        target={result.fuelNeeded}
      />
      <Card
        label="Effective mileage"
        value={(v) => `${formatNumber(v)} ${unit}`}
        target={result.effectiveMileage}
        note={derivation}
      />
      <Card
        label="Price used"
        value={() => `${formatCurrency(result.breakdown.pricePerUnit)} / ${fuelUnit}`}
        target={result.breakdown.pricePerUnit}
        note={priceLabel}
        muted
      />
    </div>
  );
}

interface CardProps {
  label: string;
  value: (animated: number) => string;
  target: number;
  note?: string;
  big?: boolean;
  muted?: boolean;
}

// a single labelled stat box; the headline number counts up to its target on mount/update unless the
// visitor prefers reduced motion
function Card({ label, value, target, note, big, muted }: CardProps) {
  const animated = useRollUp(target);
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
      }}
    >
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{label}</div>
      <div
        style={{
          fontSize: big ? '1.75rem' : muted ? '1rem' : '1.5rem',
          fontWeight: muted ? 400 : 600,
        }}
      >
        {value(animated)}
      </div>
      {note && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{note}</div>}
    </div>
  );
}

// animates a number counting up (ease-out) from its previous value to a new target; collapses to an
// instant jump when the visitor's system requests reduced motion
function useRollUp(target: number): number {
  const [displayed, setDisplayed] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || from.current === target) {
      from.current = target;
      setDisplayed(target);
      return;
    }

    const start = from.current;
    const delta = target - start;
    const startTime = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - startTime) / ROLL_UP_DURATION_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayed(start + delta * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        from.current = target;
      }
    }

    frame = requestAnimationFrame(tick);
    // requestAnimationFrame is paused while the tab is backgrounded, which could otherwise leave a
    // stale (wrong) number on screen indefinitely — this timer forces the correct final value
    // regardless of tab visibility, since setTimeout still runs (if throttled) in the background
    const settle = setTimeout(() => {
      from.current = target;
      setDisplayed(target);
    }, ROLL_UP_DURATION_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [target]);

  return displayed;
}

export default ResultCards;
