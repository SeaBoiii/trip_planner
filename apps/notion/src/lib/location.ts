import type { GeocodingSearchResult, Item, Location } from '@trip-planner/core';

export function getItemLocationLabel(item: Pick<Item, 'location' | 'locationText'>): string | undefined {
  const label = item.location?.displayName ?? item.locationText?.trim();
  return label || undefined;
}

export function toStructuredLocation(result: GeocodingSearchResult): Location {
  return {
    source: 'nominatim_osm',
    displayName: result.displayName,
    lat: result.lat,
    lon: result.lon,
    address: result.address,
    osm: {
      osmType: result.osmType,
      osmId: result.osmId,
    },
  };
}

export function getOpenStreetMapViewUrl(location: Pick<Location, 'lat' | 'lon'>, zoom = 16) {
  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lon}#map=${zoom}/${location.lat}/${location.lon}`;
}
