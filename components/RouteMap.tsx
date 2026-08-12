"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapStop = { name: string; coordinates: [number, number]; status?: string };

export default function RouteMap({ stops }: { stops: MapStop[] }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  useEffect(() => {
    if (!token || !mapElement.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({ container: mapElement.current, style: "mapbox://styles/mapbox/light-v11", center: stops[0]?.coordinates ?? [76.8897, 43.2383], zoom: 11.5 });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true }), "top-right");
    if (stops.length > 1) { const bounds = new mapboxgl.LngLatBounds(); stops.forEach(stop => bounds.extend(stop.coordinates)); map.fitBounds(bounds, { padding: 42, maxZoom: 13 }); }
    stops.forEach((stop, index) => new mapboxgl.Marker({ color: index < 2 ? "#159143" : "#102e31" }).setLngLat(stop.coordinates).setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`${index + 1}. ${stop.name}${stop.status ? ` · ${stop.status}` : ""}`)).addTo(map));
    const coordinates = stops.map(stop => stop.coordinates.join(",")).join(";");
    if (stops.length > 1) fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${token}`).then(response => response.json()).then(data => { const geometry = data.routes?.[0]?.geometry; if (!geometry) return; const addRoute = () => { if (!map.isStyleLoaded() || map.getSource("daily-route")) return; map.addSource("daily-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry } }); map.addLayer({ id: "daily-route-line", type: "line", source: "daily-route", paint: { "line-color": "#159143", "line-width": 4, "line-opacity": 0.85 } }); }; if (map.isStyleLoaded()) addRoute(); else map.once("load", addRoute); }).catch(() => undefined);
    return () => map.remove();
  }, [stops, token]);
  if (!token) return <div className="route-map-fallback"><b>⌖</b><strong>Mapbox картасы</strong><small>Vercel Environment Variables ішіне<br/>NEXT_PUBLIC_MAPBOX_TOKEN қосылса, карта іске қосылады.</small><i>●　　●　　●<br/>　●　　●　　●</i></div>;
  return <div className="route-map-live" ref={mapElement} aria-label="Күндік маршрут картасы" />;
}
