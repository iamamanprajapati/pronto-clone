import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapWorker {
  workerId?: string;
  name?: string;
  lat: number;
  lng: number;
  duty: string;
}

const DUTY_COLOR: Record<string, string> = {
  IDLE: '#0BA05A', EN_ROUTE: '#E6007E', ON_JOB: '#B45309', OFFERED: '#F472B6',
};

export function LiveMap({ workers, center }: { workers: MapWorker[]; center: [number, number] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 } },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [center[1], center[0]],
      zoom: 13,
    });
    return () => { map.current?.remove(); map.current = null; };
  }, [center]);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach(m => m.remove());
    markers.current = workers.map(w => {
      const dot = document.createElement('div');
      dot.style.cssText = `width:14px;height:14px;border-radius:50%;border:2px solid white;background:${DUTY_COLOR[w.duty] ?? '#888'}`;
      dot.title = `${w.name ?? 'Expert'} · ${w.duty}`;
      return new maplibregl.Marker({ element: dot }).setLngLat([w.lng, w.lat]).addTo(map.current!);
    });
  }, [workers]);

  return <div ref={el} className="mapBox" />;
}
