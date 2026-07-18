export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

export interface Route {
  distanceKm: number;
  coordinates: [number, number][];
}

export class GeoError extends Error {}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

// looks up place candidates for a search string via Nominatim, biased to India since that's the app's scope
export async function geocode(query: string): Promise<GeoPoint[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'in',
    limit: '5',
  });
  let response: Response;
  try {
    response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new GeoError('could not reach the map search service');
  }
  if (!response.ok) throw new GeoError('map search failed');
  const body = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  return body.map((place) => ({
    lat: Number(place.lat),
    lon: Number(place.lon),
    label: place.display_name,
  }));
}

// gets the driving route and distance between two points via the OSRM public demo server
export async function route(from: GeoPoint, to: GeoPoint): Promise<Route> {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const params = new URLSearchParams({ overview: 'full', geometries: 'geojson' });
  let response: Response;
  try {
    response = await fetch(`${OSRM_URL}/${coords}?${params.toString()}`);
  } catch {
    throw new GeoError('could not reach the routing service');
  }
  if (!response.ok) throw new GeoError('could not find a driving route between those points');
  const body = (await response.json()) as {
    code: string;
    routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
  };
  if (body.code !== 'Ok' || !body.routes || body.routes.length === 0) {
    throw new GeoError('no driving route found between those points');
  }
  const best = body.routes[0];
  return {
    distanceKm: best.distance / 1000,
    coordinates: best.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
  };
}
