import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, DimensionValue } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { IOSColors, IOSTypography } from '../../theme/ios';
import { IOSIcon } from '../ios';
import { MAPBOX_CONFIG } from '../../config/mapbox';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  species: 'cat' | 'dog' | 'unknown';
  title?: string;
  subtitle?: string;
  distance_from_path_m?: number;
}

export interface ColonyMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  estimatedPopulation: number;
  tnrPercent: number;
  hasWaterStation?: boolean;
  hasShelter?: boolean;
}

export interface FocusCoordinate {
  latitude: number;
  longitude: number;
  zoom?: number;
}

interface InteractiveMapViewProps {
  initialLat?: number;
  initialLon?: number;
  initialZoom?: number;
  focusCoordinate?: FocusCoordinate | null;
  markers?: MapMarker[];
  colonyMarkers?: ColonyMarker[];
  trackCoordinates?: [number, number][]; // [lat, lon]
  routeCorridorCoordinates?: [number, number][]; // Planned transect corridor [lat, lon]
  showUserLocation?: boolean;
  onMarkerPress?: (markerId: string) => void;
  onColonyPress?: (colonyId: string) => void;
  height?: DimensionValue;
}

export const InteractiveMapView: React.FC<InteractiveMapViewProps> = ({
  initialLat = MAPBOX_CONFIG.defaultCenter.latitude,
  initialLon = MAPBOX_CONFIG.defaultCenter.longitude,
  initialZoom = MAPBOX_CONFIG.defaultZoom,
  focusCoordinate,
  markers = [],
  colonyMarkers = [],
  trackCoordinates = [],
  routeCorridorCoordinates = [],
  showUserLocation = true,
  onMarkerPress,
  onColonyPress,
  height = '100%',
}) => {
  const webViewRef = useRef<WebView>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<'streets' | 'satellite' | 'outdoors'>('streets');
  const [showColoniesLayer, setShowColoniesLayer] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; acc: number } | null>(null);

  // Request live device GPS location using expo-location
  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;

    async function startGPS() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLocation({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            acc: loc.coords.accuracy || 5,
          });

          locationSub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 },
            (newLoc) => {
              setUserLocation({
                lat: newLoc.coords.latitude,
                lon: newLoc.coords.longitude,
                acc: newLoc.coords.accuracy || 5,
              });
            }
          );
        }
      } catch (e) {
        setUserLocation({ lat: initialLat, lon: initialLon, acc: 3.5 });
      }
    }

    startGPS();

    return () => {
      if (locationSub) {
        locationSub.remove();
      }
    };
  }, []);

  // Sync markers, colonies, corridor, track coordinates, and user location to Mapbox GL JS
  useEffect(() => {
    if (!mapLoaded || !webViewRef.current) return;

    const dataPayload = JSON.stringify({
      markers,
      colonyMarkers: showColoniesLayer ? colonyMarkers : [],
      trackCoordinates,
      routeCorridorCoordinates,
      userLocation: showUserLocation ? userLocation : null,
    });

    const js = `if (window.updateMapboxData) { window.updateMapboxData(${dataPayload}); } true;`;
    webViewRef.current.injectJavaScript(js);
  }, [markers, colonyMarkers, showColoniesLayer, trackCoordinates, routeCorridorCoordinates, userLocation, mapLoaded, showUserLocation]);

  // Smooth camera auto-centering effect on target coordinate
  useEffect(() => {
    if (!mapLoaded || !webViewRef.current || !focusCoordinate) return;
    const z = focusCoordinate.zoom || 16;
    const js = `if (window.centerOnUser) { window.centerOnUser(${focusCoordinate.latitude}, ${focusCoordinate.longitude}, ${z}); } true;`;
    webViewRef.current.injectJavaScript(js);
  }, [focusCoordinate, mapLoaded]);

  const toggleLayer = () => {
    let next: 'streets' | 'satellite' | 'outdoors' = 'streets';
    if (currentLayer === 'streets') next = 'satellite';
    else if (currentLayer === 'satellite') next = 'outdoors';
    else next = 'streets';

    setCurrentLayer(next);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.switchMapboxStyle) { window.switchMapboxStyle("${next}"); } true;`);
    }
  };

  const centerOnUser = () => {
    if (webViewRef.current && userLocation) {
      webViewRef.current.injectJavaScript(`if (window.centerOnUser) { window.centerOnUser(${userLocation.lat}, ${userLocation.lon}); } true;`);
    }
  };

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></script>
  <style>
    body, html, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0F172A;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    .custom-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 30px;
      padding: 0 6px;
      border-radius: 15px;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 11px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
      border: 2px solid #FFFFFF;
      cursor: pointer;
      letter-spacing: 0.2px;
      transition: transform 0.15s ease;
    }
    .custom-pin:active {
      transform: scale(0.92);
    }
    .cat-pin {
      background: linear-gradient(135deg, #0284C7, #0369A1);
    }
    .dog-pin {
      background: linear-gradient(135deg, #F59E0B, #D97706);
    }
    .user-puck-wrap {
      position: relative;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .user-puck {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #007AFF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 8px rgba(0, 122, 255, 0.85);
      position: relative;
      z-index: 2;
    }
    .user-pulse {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(0, 122, 255, 0.35);
      animation: mapboxPulse 2s infinite ease-out;
      z-index: 1;
    }
    @keyframes mapboxPulse {
      0% { transform: scale(0.5); opacity: 0.9; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    .mapboxgl-popup-content {
      border-radius: 14px;
      padding: 10px 14px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #FFFFFF;
      color: #0F172A;
      min-width: 150px;
    }
    .mapboxgl-popup-close-button {
      font-size: 16px;
      color: #94A3B8;
      padding: 4px 8px;
    }
    .popup-species-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 6px;
      margin-bottom: 4px;
    }
    .popup-cat-badge {
      background: #E0F2FE;
      color: #0369A1;
    }
    .popup-dog-badge {
      background: #FFEDD5;
      color: #C2410C;
    }
    .colony-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 6px;
      border-radius: 16px;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 10px;
      box-shadow: 0 4px 10px rgba(124, 58, 237, 0.45);
      border: 2px solid #FFFFFF;
      cursor: pointer;
      letter-spacing: 0.2px;
      background: linear-gradient(135deg, #7C3AED, #6D28D9);
      transition: transform 0.15s ease;
    }
    .colony-pin:active {
      transform: scale(0.92);
    }
    .popup-colony-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 6px;
      margin-bottom: 4px;
      background: #F5F3FF;
      color: #6D28D9;
    }
    .popup-coords {
      font-size: 10px;
      color: #64748B;
      font-family: monospace;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = "${MAPBOX_CONFIG.accessToken}";

    const STYLES = {
      streets: "${MAPBOX_CONFIG.styles.streets}",
      satellite: "${MAPBOX_CONFIG.styles.satellite}",
      outdoors: "${MAPBOX_CONFIG.styles.outdoors}"
    };

    var map = new mapboxgl.Map({
      container: 'map',
      style: STYLES.streets,
      center: [${initialLon}, ${initialLat}],
      zoom: ${initialZoom},
      attributionControl: false
    });

    var activeMarkers = [];
    var activeColonyMarkers = [];
    var userMarker = null;
    var currentTrackCoords = [];
    var currentCorridorCoords = [];
    var lastData = null;

    function renderRouteCorridor() {
      if (!currentCorridorCoords || currentCorridorCoords.length < 2) {
        if (map.getSource('corridor-line')) {
          map.getSource('corridor-line').setData({ type: 'FeatureCollection', features: [] });
        }
        return;
      }

      var geojson = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: currentCorridorCoords.map(function(c) { return [c[1], c[0]]; })
        }
      };

      if (map.getSource('corridor-line')) {
        map.getSource('corridor-line').setData(geojson);
      } else {
        map.addSource('corridor-line', {
          type: 'geojson',
          data: geojson
        });

        // Soft corridor glow/buffer
        map.addLayer({
          id: 'corridor-glow',
          type: 'line',
          source: 'corridor-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#06B6D4',
            'line-width': 18,
            'line-opacity': 0.2
          }
        });

        // Official corridor dashed line
        map.addLayer({
          id: 'corridor-line',
          type: 'line',
          source: 'corridor-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0284C7',
            'line-width': 3,
            'line-dasharray': [2, 2],
            'line-opacity': 0.9
          }
        });
      }
    }

    function renderRouteLine() {
      if (!currentTrackCoords || currentTrackCoords.length < 2) return;

      var geojson = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: currentTrackCoords.map(function(c) { return [c[1], c[0]]; })
        }
      };

      if (map.getSource('route-line')) {
        map.getSource('route-line').setData(geojson);
      } else {
        map.addSource('route-line', {
          type: 'geojson',
          data: geojson
        });

        // Glow underlay
        map.addLayer({
          id: 'route-line-glow',
          type: 'line',
          source: 'route-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0284C7',
            'line-width': 8,
            'line-opacity': 0.25
          }
        });

        // Primary transect stroke
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0284C7',
            'line-width': 4,
            'line-opacity': 0.95
          }
        });
      }
    }

    window.switchMapboxStyle = function(styleKey) {
      if (STYLES[styleKey]) {
        map.setStyle(STYLES[styleKey]);
        map.once('style.load', function() {
          renderRouteCorridor();
          renderRouteLine();
          if (lastData) {
            window.updateMapboxData(lastData);
          }
        });
      }
    };

    window.centerOnUser = function(lat, lon, zoom) {
      map.flyTo({
        center: [lon, lat],
        zoom: zoom || 16,
        essential: true,
        speed: 1.4
      });
    };

    window.updateMapboxData = function(data) {
      lastData = data;

      // 1. Clear existing observation markers
      activeMarkers.forEach(function(m) { m.remove(); });
      activeMarkers = [];

      // 1b. Clear existing colony markers
      activeColonyMarkers.forEach(function(m) { m.remove(); });
      activeColonyMarkers = [];

      // 2. Render animal markers
      if (data.markers && data.markers.length > 0) {
        data.markers.forEach(function(m, idx) {
          var isCat = m.species === 'cat';
          var pinEl = document.createElement('div');
          pinEl.className = 'custom-pin ' + (isCat ? 'cat-pin' : 'dog-pin');
          pinEl.innerText = (isCat ? 'CAT' : 'DOG') + ' #' + (idx + 1);

          var popupHtml =
            '<div class="popup-species-badge ' + (isCat ? 'popup-cat-badge' : 'popup-dog-badge') + '">' +
              (isCat ? 'Cat' : 'Dog') + ' #' + (idx + 1) +
            '</div>' +
            (m.distance_from_path_m !== undefined ? '<div style="font-size:12px;font-weight:600;">Distance: ' + m.distance_from_path_m + 'm</div>' : '') +
            '<div class="popup-coords">' + m.latitude.toFixed(5) + '° N, ' + m.longitude.toFixed(5) + '° E</div>';

          var popup = new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml);

          var marker = new mapboxgl.Marker({ element: pinEl })
            .setLngLat([m.longitude, m.latitude])
            .setPopup(popup)
            .addTo(map);

          pinEl.addEventListener('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker_click', id: m.id }));
            }
          });

          activeMarkers.push(marker);
        });
      }

      // 2b. Render colony markers
      if (data.colonyMarkers && data.colonyMarkers.length > 0) {
        data.colonyMarkers.forEach(function(c) {
          var pinEl = document.createElement('div');
          pinEl.className = 'colony-pin';
          pinEl.innerText = 'COLONY';

          var popupHtml =
            '<div class="popup-colony-badge">' + c.name + '</div>' +
            '<div style="font-size:12px;font-weight:600;margin-top:2px;">Pop: ~' + c.estimatedPopulation + ' cats (' + c.tnrPercent + '% TNR)</div>' +
            '<div class="popup-coords">' + c.latitude.toFixed(5) + '° N, ' + c.longitude.toFixed(5) + '° E</div>';

          var popup = new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml);

          var marker = new mapboxgl.Marker({ element: pinEl })
            .setLngLat([c.longitude, c.latitude])
            .setPopup(popup)
            .addTo(map);

          pinEl.addEventListener('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'colony_click', id: c.id }));
            }
          });

          activeColonyMarkers.push(marker);
        });
      }

      // 3. Render planned corridor
      if (data.routeCorridorCoordinates) {
        currentCorridorCoords = data.routeCorridorCoordinates;
        if (map.isStyleLoaded()) {
          renderRouteCorridor();
        }
      }

      // 4. Render transect path
      if (data.trackCoordinates) {
        currentTrackCoords = data.trackCoordinates;
        if (map.isStyleLoaded()) {
          renderRouteLine();
        }
      }

      // 5. Render live GPS User Puck
      if (data.userLocation) {
        if (!userMarker) {
          var puckWrap = document.createElement('div');
          puckWrap.className = 'user-puck-wrap';
          puckWrap.innerHTML = '<div class="user-pulse"></div><div class="user-puck"></div>';

          userMarker = new mapboxgl.Marker({ element: puckWrap })
            .setLngLat([data.userLocation.lon, data.userLocation.lat])
            .addTo(map);
        } else {
          userMarker.setLngLat([data.userLocation.lon, data.userLocation.lat]);
        }
      }
    };

    map.on('load', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map_ready' }));
      }
      renderRouteCorridor();
      renderRouteLine();
    });
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.webView}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'map_ready') {
              setMapLoaded(true);
            } else if (data.type === 'marker_click' && onMarkerPress) {
              onMarkerPress(data.id);
            } else if (data.type === 'colony_click' && onColonyPress) {
              onColonyPress(data.id);
            }
          } catch (e) {}
        }}
        scrollEnabled={false}
        bounces={false}
      />

      {/* Floating Modern Map Controls (Airy Apple/Tactile Style) */}
      <View style={styles.floatingControls}>
        <TouchableOpacity
          style={styles.controlPill}
          onPress={toggleLayer}
          activeOpacity={0.7}
        >
          <IOSIcon name="map" size={15} color={IOSColors.label} />
          <Text style={styles.controlPillText}>
            {currentLayer === 'streets'
              ? 'Satellite'
              : currentLayer === 'satellite'
              ? 'Outdoors'
              : 'Streets'}
          </Text>
        </TouchableOpacity>

        {colonyMarkers.length > 0 && (
          <TouchableOpacity
            style={[styles.controlPill, showColoniesLayer && styles.controlPillActive]}
            onPress={() => setShowColoniesLayer(!showColoniesLayer)}
            activeOpacity={0.7}
          >
            <IOSIcon
              name="shield"
              size={13}
              color={showColoniesLayer ? '#FFFFFF' : '#7C3AED'}
            />
            <Text
              style={[
                styles.controlPillText,
                showColoniesLayer && styles.controlPillTextActive,
              ]}
            >
              Colonies {showColoniesLayer ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.controlCircle}
          onPress={centerOnUser}
          activeOpacity={0.7}
        >
          <IOSIcon name="location" size={18} color={IOSColors.systemTeal} />
        </TouchableOpacity>
      </View>

      {/* Accuracy Tag */}
      {userLocation ? (
        <View style={styles.accuracyTag}>
          <View style={styles.pulseDot} />
          <Text style={styles.accuracyText}>
            Mapbox GPS ±{userLocation.acc.toFixed(1)}m • Live
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  floatingControls: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-end',
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  controlPillActive: {
    backgroundColor: '#7C3AED',
  },
  controlPillText: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.label,
  },
  controlPillTextActive: {
    color: '#FFFFFF',
  },
  controlCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  accuracyTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOSColors.systemGreen,
  },
  accuracyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
