import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    // Basemap retrieved from backend endpoint /api/map
    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: '/api/map/style.json',
      center: [-85.7585, 38.2527], // Default jurisdiction coordinates (Louisville / Jefferson County)
      zoom: 12,
    });

    mapInstance.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
