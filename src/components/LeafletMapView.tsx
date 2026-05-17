/**
 * LeafletMapView — Google-free map component using OpenStreetMap tiles + Leaflet.js
 * Rendered inside a WebView so it works in Expo Go with zero native setup / API keys.
 *
 * Exposed ref methods:
 *   updateUserLocation(lat, lng) — move the live blue dot without re-mounting the map
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';

export interface LeafletMapRef {
  updateUserLocation: (lat: number, lng: number) => void;
}

export interface LMarker {
  id: string;
  latitude: number;
  longitude: number;
  color?: string;     // hex, e.g. '#6366f1'
  label?: string;     // popup title
  sublabel?: string;  // popup subtitle
}

export interface LRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface Props {
  style?: object;
  region: LRegion;
  markers?: LMarker[];
  polylineCoords?: { latitude: number; longitude: number }[];
  polylineColor?: string;
  onMarkerPress?: (id: string) => void;
  /** Called when the user taps an empty area of the map */
  onMapPress?: (lat: number, lng: number) => void;
  /** Initial user location dot (live updates via ref.updateUserLocation) */
  userLocation?: { latitude: number; longitude: number } | null;
}

function deltaToZoom(delta: number): number {
  return Math.max(1, Math.min(16, Math.round(Math.log2(360 / delta))));
}

function escStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

const LeafletMapView = forwardRef<LeafletMapRef, Props>(({
  style,
  region,
  markers = [],
  polylineCoords,
  polylineColor = '#6366f1',
  onMarkerPress,
  onMapPress,
  userLocation,
}, ref) => {
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    updateUserLocation(lat: number, lng: number) {
      webViewRef.current?.injectJavaScript(`
        (function(){
          if(!window._locDot){
            window._locDot=L.circleMarker([${lat},${lng}],{
              radius:8,color:'#3b82f6',fillColor:'#3b82f6',fillOpacity:1,weight:2.5,zIndexOffset:1000
            }).addTo(map);
          } else { window._locDot.setLatLng([${lat},${lng}]); }
        })(); true;
      `);
    },
  }));

  const markersJs = markers
    .map((m) => {
      const color = m.color ?? '#6366f1';
      const popup = [m.label, m.sublabel]
        .filter(Boolean)
        .map((s) => escStr(s!))
        .join('<br>');
      return `(function(){
        var mk=L.marker([${m.latitude},${m.longitude}],{
          icon:L.divIcon({
            className:'',
            html:'<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);"></div>',
            iconAnchor:[7,7]
          })
        }).addTo(map);
        ${popup ? `mk.bindPopup('${popup}');` : ''}
        mk.on('click',function(e){
          L.DomEvent.stopPropagation(e);
          RN&&RN.postMessage(JSON.stringify({type:'marker',id:'${escStr(m.id)}'}));
        });
      })();`;
    })
    .join('\n');

  const polylineJs =
    polylineCoords && polylineCoords.length > 1
      ? `L.polyline([${polylineCoords
          .map((c) => `[${c.latitude},${c.longitude}]`)
          .join(',')}],{color:'${polylineColor}',weight:3,dashArray:'8,4',opacity:0.85}).addTo(map);`
      : '';

  const initLocJs = userLocation
    ? `window._locDot=L.circleMarker([${userLocation.latitude},${userLocation.longitude}],{
        radius:8,color:'#3b82f6',fillColor:'#3b82f6',fillOpacity:1,weight:2.5,zIndexOffset:1000
      }).addTo(map);`
    : '';

  const z = deltaToZoom(region.latitudeDelta);

  const html = `<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body,#map{width:100%;height:100%;background:#1a1a2e;}
    .leaflet-control-attribution{font-size:9px!important;opacity:.5;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var RN=window.ReactNativeWebView||null;
    var map=L.map('map',{zoomControl:true}).setView([${region.latitude},${region.longitude}],${z});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(map);
    ${markersJs}
    ${polylineJs}
    ${initLocJs}
    map.on('click',function(e){
      RN&&RN.postMessage(JSON.stringify({type:'click',lat:e.latlng.lat,lng:e.latlng.lng}));
    });
  </script>
</body></html>`;

  return (
    <WebView
      ref={webViewRef}
      style={[{ flex: 1 }, style]}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'marker') onMarkerPress?.(msg.id);
          else if (msg.type === 'click') onMapPress?.(msg.lat, msg.lng);
        } catch {
          onMarkerPress?.(e.nativeEvent.data);
        }
      }}
    />
  );
});

export default LeafletMapView;

