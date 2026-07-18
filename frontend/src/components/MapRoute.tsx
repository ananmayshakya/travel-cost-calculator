import { useEffect, useRef, useState, type CSSProperties } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { GeoError, geocode, route, type GeoPoint } from '../lib/geo';
import { formatNumber } from '../lib/format';

// Vite serves Leaflet's marker images as hashed URLs rather than the relative paths the library expects
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const INDIA_CENTER: [number, number] = [22.5, 79];
const SEARCH_DEBOUNCE_MS = 600;

// standard OSM tiles draw international borders per neutral convention, not India's official claim
// (e.g. Kashmir) — this overlay redraws India's boundary as per the Survey of India on top of them
const INDIA_BOUNDARY_URL = '/data/india-boundary.geojson';

interface MapRouteProps {
  onDistanceChange: (km: number | null) => void;
}

// map-based distance input: search from/to via Nominatim, draw the OSRM driving route on a Leaflet
// map, and report the resulting distance up to the shared trip form
function MapRoute({ onDistanceChange }: MapRouteProps) {
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromSuggestions, setFromSuggestions] = useState<GeoPoint[]>([]);
  const [toSuggestions, setToSuggestions] = useState<GeoPoint[]>([]);
  const [fromPoint, setFromPoint] = useState<GeoPoint | null>(null);
  const [toPoint, setToPoint] = useState<GeoPoint | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const fromMarker = useRef<L.Marker | null>(null);
  const toMarker = useRef<L.Marker | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);

  // creates the Leaflet map once on mount
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView(INDIA_CENTER, 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; OpenStreetMap contributors &middot; India boundary: DataMeet (CC BY 4.0)',
    }).addTo(map);
    mapInstance.current = map;

    fetch(INDIA_BOUNDARY_URL)
      .then((response) => response.json())
      .then((geojson) => {
        // Leaflet's SVG renderer won't resolve CSS custom properties, so this is a plain hex
        L.geoJSON(geojson, { style: { color: '#ff9933', weight: 3, opacity: 0.9 } }).addTo(map);
      })
      .catch(() => {
        // the overlay is a compliance layer, not required for the map to function — fail quietly
      });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // debounces the "from" search query and fetches suggestions from Nominatim
  useEffect(() => {
    if (fromQuery.length < 3 || (fromPoint && fromQuery === fromPoint.label)) {
      setFromSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      geocode(fromQuery)
        .then(setFromSuggestions)
        .catch((err: unknown) =>
          setSearchError(err instanceof GeoError ? err.message : 'search failed'),
        );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fromQuery, fromPoint]);

  // debounces the "to" search query and fetches suggestions from Nominatim
  useEffect(() => {
    if (toQuery.length < 3 || (toPoint && toQuery === toPoint.label)) {
      setToSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      geocode(toQuery)
        .then(setToSuggestions)
        .catch((err: unknown) =>
          setSearchError(err instanceof GeoError ? err.message : 'search failed'),
        );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [toQuery, toPoint]);

  // once both points are known, fetches the driving route and draws it on the map
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (fromMarker.current) {
      fromMarker.current.remove();
      fromMarker.current = null;
    }
    if (toMarker.current) {
      toMarker.current.remove();
      toMarker.current = null;
    }
    if (routeLine.current) {
      routeLine.current.remove();
      routeLine.current = null;
    }

    if (fromPoint)
      fromMarker.current = L.marker([fromPoint.lat, fromPoint.lon]).addTo(map).bindPopup('From');
    if (toPoint) toMarker.current = L.marker([toPoint.lat, toPoint.lon]).addTo(map).bindPopup('To');

    if (!fromPoint || !toPoint) {
      setDistanceKm(null);
      onDistanceChange(null);
      return;
    }

    setRouteError(null);
    setRouteLoading(true);
    route(fromPoint, toPoint)
      .then((result) => {
        routeLine.current = L.polyline(result.coordinates, { color: '#4f8cff', weight: 4 }).addTo(
          map,
        );
        map.fitBounds(routeLine.current.getBounds(), { padding: [24, 24] });
        setDistanceKm(result.distanceKm);
        onDistanceChange(result.distanceKm);
      })
      .catch((err: unknown) => {
        setRouteError(err instanceof GeoError ? err.message : 'could not compute a route');
        setDistanceKm(null);
        onDistanceChange(null);
      })
      .finally(() => setRouteLoading(false));
  }, [fromPoint, toPoint, onDistanceChange]);

  // stages a chosen suggestion as the "from" point and closes the suggestion list
  function chooseFrom(point: GeoPoint) {
    setFromPoint(point);
    setFromQuery(point.label);
    setFromSuggestions([]);
  }

  // stages a chosen suggestion as the "to" point and closes the suggestion list
  function chooseTo(point: GeoPoint) {
    setToPoint(point);
    setToQuery(point.label);
    setToSuggestions([]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          position: 'relative',
        }}
      >
        <label style={labelStyle}>
          From
          <input
            type="text"
            value={fromQuery}
            onChange={(event) => {
              setFromQuery(event.target.value);
              if (fromPoint) setFromPoint(null);
            }}
            placeholder="Search a city or place"
            style={inputStyle}
          />
        </label>
        {fromSuggestions.length > 0 && (
          <ul style={suggestionListStyle}>
            {fromSuggestions.map((point, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => chooseFrom(point)}
                  style={suggestionButtonStyle}
                >
                  {point.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <label style={labelStyle}>
          To
          <input
            type="text"
            value={toQuery}
            onChange={(event) => {
              setToQuery(event.target.value);
              if (toPoint) setToPoint(null);
            }}
            placeholder="Search a city or place"
            style={inputStyle}
          />
        </label>
        {toSuggestions.length > 0 && (
          <ul style={suggestionListStyle}>
            {toSuggestions.map((point, index) => (
              <li key={index}>
                <button type="button" onClick={() => chooseTo(point)} style={suggestionButtonStyle}>
                  {point.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div ref={mapRef} style={mapStyle} />
      <p style={boundaryNoteStyle}>
        Map used for distance calculation only. India's boundary (in orange) is shown as per the
        Survey of India; underlying map tiles are &copy; OpenStreetMap contributors.
      </p>

      {routeLoading && (
        <p style={{ color: 'var(--color-text-muted)' }}>Finding the driving route…</p>
      )}
      {routeError && <p style={{ color: '#f87171' }}>{routeError}</p>}
      {searchError && <p style={{ color: '#f87171' }}>{searchError}</p>}
      {distanceKm !== null && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Driving distance: {formatNumber(distanceKm, 1)} km
        </p>
      )}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
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

const suggestionListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  maxHeight: '150px',
  overflowY: 'auto',
};

const suggestionButtonStyle: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: 'var(--space-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
  cursor: 'pointer',
};

const mapStyle: CSSProperties = {
  height: '320px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
};

const boundaryNoteStyle: CSSProperties = {
  margin: 0,
  color: 'var(--color-text-muted)',
  fontSize: '0.75rem',
};

export default MapRoute;
