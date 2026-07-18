import { useState } from 'react';
import './styles/tokens.css';
import ModeToggle, { type Mode } from './components/ModeToggle';
import TripForm from './components/TripForm';
import ResultCards from './components/ResultCards';
import type { CalculateTripResult } from './types';

// top-level layout: mode switch, the active entry form, and the result once a calculation succeeds
function App() {
  const [mode, setMode] = useState<Mode>('manual');
  const [result, setResult] = useState<CalculateTripResult | null>(null);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
        maxWidth: '640px',
        margin: '0 auto',
        padding: 'var(--space-lg) var(--space-md)',
      }}
    >
      <div>
        <h1>Travel Cost Calculator</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Estimate the fuel cost of a road trip in India.
        </p>
      </div>

      <ModeToggle mode={mode} onChange={setMode} />

      <TripForm mode={mode} onResult={setResult} />

      {result && <ResultCards result={result} />}
    </main>
  );
}

export default App;
