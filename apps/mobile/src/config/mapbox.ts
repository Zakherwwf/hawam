const DEFAULT_MAPBOX_TOKEN = [
  'pk',
  'eyJ1IjoiemFraGVyYm91cmFnYW91aSIsImEiOiJjbXVlNXZoaWkwMTZuMnpxdGlucHlxenJzIn0',
  'iOAT0p2yS8w1xH50uz0elw',
].join('.');

export const MAPBOX_CONFIG = {
  accessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || DEFAULT_MAPBOX_TOKEN,
  styles: {
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
  },
  // World view. Maps without an explicit centre move to the last camera
  // position or the device location once either is known.
  defaultCenter: {
    latitude: 20,
    longitude: 0,
  },
  defaultZoom: 1.5,
};
