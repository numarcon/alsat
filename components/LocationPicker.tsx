"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type LocationValue = { latitude: number; longitude: number };

const TILE_SIZE = 256;
const DEFAULT_LOCATION: LocationValue = { latitude: 43.2383, longitude: 76.8897 };

function clampLatitude(latitude: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function toWorld(location: LocationValue, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = clampLatitude(location.latitude) * Math.PI / 180;
  return {
    x: (location.longitude + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + Math.sin(latitude)) / (1 - Math.sin(latitude))) / (4 * Math.PI)) * scale,
  };
}

function fromWorld(x: number, y: number, zoom: number): LocationValue {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const latitude = 180 / Math.PI * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

function tileX(x: number, zoom: number) {
  const count = 2 ** zoom;
  return ((x % count) + count) % count;
}

export default function LocationPicker({ value, onChange }: { value: LocationValue | null; onChange: (value: LocationValue) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(340);
  const [mapHeight, setMapHeight] = useState(230);
  const [zoom, setZoom] = useState(12);
  const [center, setCenter] = useState<LocationValue>(value ?? DEFAULT_LOCATION);

  useEffect(() => {
    if (!mapRef.current) return;
    const element = mapRef.current;
    const updateSize = () => {
      setMapWidth(element.clientWidth || 340);
      setMapHeight(element.clientHeight || 230);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const centerWorld = useMemo(() => toWorld(center, zoom), [center, zoom]);
  const originX = centerWorld.x - mapWidth / 2;
  const originY = centerWorld.y - mapHeight / 2;
  const tiles = useMemo(() => {
    const firstX = Math.floor(originX / TILE_SIZE) - 1;
    const lastX = Math.floor((originX + mapWidth) / TILE_SIZE) + 1;
    const firstY = Math.floor(originY / TILE_SIZE) - 1;
    const lastY = Math.floor((originY + mapHeight) / TILE_SIZE) + 1;
    const count = 2 ** zoom;
    const result: Array<{ key: string; x: number; y: number; left: number; top: number }> = [];
    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = Math.max(0, firstY); y <= Math.min(count - 1, lastY); y += 1) {
        result.push({ key: `${zoom}-${x}-${y}`, x: tileX(x, zoom), y, left: x * TILE_SIZE - originX, top: y * TILE_SIZE - originY });
      }
    }
    return result;
  }, [mapHeight, mapWidth, originX, originY, zoom]);

  const marker = value ? toWorld(value, zoom) : null;
  const markerPosition = marker ? { left: marker.x - originX, top: marker.y - originY } : null;

  const chooseLocation = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const location = fromWorld(originX + event.clientX - rect.left, originY + event.clientY - rect.top, zoom);
    onChange(location);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCenter(next);
      onChange(next);
    });
  };

  return <div className="location-picker">
    <div className="location-picker-head"><div><strong>Дүкен нүктесі *</strong><small>Картадан дүкеннің тұрған жерін басыңыз</small></div><button type="button" onClick={useCurrentLocation}>Менің орным</button></div>
    <div className="location-map" ref={mapRef} onClick={chooseLocation} role="application" aria-label="Дүкен орналасқан жерді таңдаңыз">
      {tiles.map((tile) => <img key={tile.key} src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`} alt="" draggable={false} style={{ left: tile.left, top: tile.top }} />)}
      <div className="location-map-overlay">Нүктені белгілеу үшін картаны басыңыз</div>
      {markerPosition && <span className="location-marker" style={{ left: markerPosition.left, top: markerPosition.top }} aria-label="Таңдалған нүкте">●</span>}
      <div className="location-zoom"><button type="button" onClick={(event) => { event.stopPropagation(); setZoom((current) => Math.min(17, current + 1)); }}>+</button><button type="button" onClick={(event) => { event.stopPropagation(); setZoom((current) => Math.max(10, current - 1)); }}>−</button></div>
    </div>
    <div className={value ? "location-readout selected" : "location-readout"}>{value ? `Нүкте таңдалды · ${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}` : "Нүкте әлі таңдалмады"}</div>
    <small className="location-attribution">© OpenStreetMap contributors</small>
  </div>;
}
