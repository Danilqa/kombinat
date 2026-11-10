import { text } from 'node:stream/consumers';

interface Place {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

function parseJson(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function readCity(body: string): string | null {
  const request = parseJson(body);
  if (typeof request !== 'object' || request === null || !('city' in request)) return null;
  return typeof request.city === 'string' && request.city.length <= 100 ? request.city : null;
}

function readPlace(geocoding: unknown): Place | null {
  if (typeof geocoding !== 'object' || geocoding === null || !('results' in geocoding)) return null;
  const place: unknown = Array.isArray(geocoding.results) ? geocoding.results[0] : null;
  if (typeof place !== 'object' || place === null) return null;
  if (!('name' in place) || !('country' in place)) return null;
  if (!('latitude' in place) || !('longitude' in place)) return null;
  const { name, country, latitude, longitude } = place;
  if (typeof name !== 'string' || typeof country !== 'string') return null;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { name, country, latitude, longitude };
}

async function findPlace(city: string): Promise<Place | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: city, count: '1', language: 'en' }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`geocoding answered ${String(response.status)}`);
  return readPlace(await response.json());
}

const city = readCity(await text(process.stdin));
// The agent gets the place the geocoder found, never the sender's text.
const place = city === null ? null : await findPlace(city);
if (place === null) {
  console.log(JSON.stringify({ ok: false, error: 'Send a city, for example {"city": "Berlin"}' }));
  process.exit(78);
}
console.log(JSON.stringify(place));
