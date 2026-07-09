import React, { useEffect, useRef } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MCI } from './icons';

/**
 * Cross-platform map.
 * iOS → react-native-maps (Apple Maps, works in Expo Go).
 * Android → Leaflet/OpenStreetMap in a WebView, because Expo Go on Android
 * no longer bundles Google Maps and react-native-maps renders black there.
 */
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  kind: 'me' | 'expert' | 'pin';
  label?: string;
}

const PINK = '#E6007E';
const DARK = '#1A1A1A';

export function AppMap({ center, markers, route, onPress, delta = 0.02, style }: {
  center: { lat: number; lng: number };
  markers: MapPin[];
  route?: Array<{ lat: number; lng: number }>;
  onPress?: (p: { lat: number; lng: number }) => void;
  delta?: number;
  style?: ViewStyle;
}) {
  if (Platform.OS === 'ios') {
    return (
      <MapView
        style={[{ flex: 1 }, style]}
        showsUserLocation
        region={{ latitude: center.lat, longitude: center.lng, latitudeDelta: delta, longitudeDelta: delta }}
        onPress={onPress ? e => onPress({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }) : undefined}>
        {route && route.length > 1 && (
          <Polyline coordinates={route.map(p => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={PINK} strokeWidth={4} />
        )}
        {markers.map(m => (
          <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lng }} title={m.label} anchor={{ x: 0.5, y: 0.5 }}>
            <MarkerGlyph kind={m.kind} />
          </Marker>
        ))}
      </MapView>
    );
  }
  return <LeafletMap center={center} markers={markers} route={route} onPress={onPress} delta={delta} style={style} />;
}

/** The native (iOS) marker glyph for each pin kind. */
function MarkerGlyph({ kind }: { kind: MapPin['kind'] }) {
  if (kind === 'me') {
    return (
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: DARK, borderWidth: 3, borderColor: 'white' }} />
    );
  }
  if (kind === 'pin') {
    return <MCI name="map-marker" size={34} color={PINK} />;
  }
  // expert
  return (
    <View style={{ backgroundColor: PINK, borderRadius: 16, padding: 5, borderWidth: 2, borderColor: 'white' }}>
      <MCI name="account-wrench" size={16} color="white" />
    </View>
  );
}

function LeafletMap({ center, markers, route, onPress, delta, style }: {
  center: { lat: number; lng: number };
  markers: MapPin[];
  route?: Array<{ lat: number; lng: number }>;
  onPress?: (p: { lat: number; lng: number }) => void;
  delta: number;
  style?: ViewStyle;
}) {
  const ref = useRef<WebView>(null);
  const zoom = Math.max(3, Math.min(18, Math.round(Math.log2(360 / delta)) - 1));

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#f2f2f2}
.wk{background:#E6007E;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.wk svg{width:16px;height:16px;fill:#fff}
.me{background:#1A1A1A;border:3px solid #fff;border-radius:50%;width:18px;height:18px;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.pn{color:#E6007E;font-size:30px;line-height:30px;text-shadow:0 1px 2px rgba(0,0,0,.3)}</style></head>
<body><div id="m"></div><script>
var WRENCH='<svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>';
function icon(kind){
  if(kind==='me')return L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]});
  if(kind==='pin')return L.divIcon({className:'',html:'<div class="pn">\\u{1F4CD}</div>',iconSize:[30,30],iconAnchor:[15,28]});
  return L.divIcon({className:'',html:'<div class="wk">'+WRENCH+'</div>',iconSize:[28,28],iconAnchor:[14,14]});
}
var map=L.map('m',{zoomControl:false}).setView([${center.lat},${center.lng}],${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OSM'}).addTo(map);
var layer=L.layerGroup().addTo(map);
var routeLine=null;
function updateMarkers(list){layer.clearLayers();list.forEach(function(m){
  var mk=L.marker([m.lat,m.lng],{icon:icon(m.kind)});
  if(m.label)mk.bindTooltip(m.label);
  mk.addTo(layer);});}
function setRoute(coords){
  if(routeLine){map.removeLayer(routeLine);routeLine=null;}
  if(coords&&coords.length>1){
    routeLine=L.polyline(coords.map(function(c){return [c.lat,c.lng];}),{color:'#E6007E',weight:4,opacity:.85}).addTo(map);
    map.fitBounds(routeLine.getBounds().pad(0.35));
  }
}
function setCenter(lat,lng){map.setView([lat,lng]);}
map.on('click',function(e){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'press',lat:e.latlng.lat,lng:e.latlng.lng}));});
updateMarkers(${JSON.stringify(markers)});
setRoute(${JSON.stringify(route ?? [])});
</script></body></html>`;

  useEffect(() => {
    ref.current?.injectJavaScript(`updateMarkers(${JSON.stringify(markers)});true;`);
  }, [JSON.stringify(markers)]);

  useEffect(() => {
    ref.current?.injectJavaScript(`setRoute(${JSON.stringify(route ?? [])});true;`);
  }, [JSON.stringify(route)]);

  useEffect(() => {
    // only recenter manually when there's no route driving the viewport
    if (!route || route.length < 2) ref.current?.injectJavaScript(`setCenter(${center.lat},${center.lng});true;`);
  }, [center.lat, center.lng, route]);

  return (
    <WebView
      ref={ref}
      source={{ html }}
      style={[{ flex: 1 }, style]}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={e => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'press' && onPress) onPress({ lat: msg.lat, lng: msg.lng });
        } catch { /* ignore */ }
      }}
    />
  );
}
