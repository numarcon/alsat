"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type NavigationStop = {
  id: string;
  name: string;
  address: string;
  time: string;
  coordinates: [number, number];
};

type DriverPosition = {
  coordinates: [number, number];
  accuracy: number;
  heading: number | null;
};

type DirectionsStep = {
  distance: number;
  duration: number;
  name?: string;
  maneuver: {
    type: string;
    modifier?: string;
    instruction?: string;
  };
};

type DirectionsRoute = {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  legs: Array<{ distance: number; duration: number; steps: DirectionsStep[] }>;
};

type DirectionsResponse = {
  code?: string;
  message?: string;
  routes?: DirectionsRoute[];
};

type RouteSummary = {
  totalDistance: number;
  totalDuration: number;
  nextDistance: number;
  nextDuration: number;
};

const previewOrigin: [number, number] = [76.8799, 43.2327];

function distanceBetween(a: [number, number], b: [number, number]) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(b[1] - a[1]);
  const longitudeDelta = toRadians(b[0] - a[0]);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDistance(meters: number) {
  if (meters < 1_000) return `${Math.max(10, Math.round(meters / 10) * 10)} м`;
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 1 : 0)} км`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} сағ ${rest} мин` : `${hours} сағ`;
}

function maneuverIcon(step?: DirectionsStep) {
  if (!step) return "↑";
  if (step.maneuver.type === "arrive") return "●";
  if (step.maneuver.type === "roundabout" || step.maneuver.type === "rotary") return "↻";
  if (step.maneuver.modifier?.includes("left")) return "↰";
  if (step.maneuver.modifier?.includes("right")) return "↱";
  if (step.maneuver.modifier === "uturn") return "↶";
  return "↑";
}

function maneuverText(step: DirectionsStep | undefined, destination: string) {
  if (!step) return `${destination} бағытымен қозғалыңыз`;
  const road = step.name?.trim();
  const roadText = road ? `, ${road} көшесіне` : "";
  const modifier: Record<string, string> = {
    left: "солға",
    "slight left": "сәл солға",
    "sharp left": "қатты солға",
    right: "оңға",
    "slight right": "сәл оңға",
    "sharp right": "қатты оңға",
    straight: "тіке",
    uturn: "кері",
  };
  const direction = modifier[step.maneuver.modifier ?? ""] ?? "тіке";
  switch (step.maneuver.type) {
    case "arrive":
      return `${destination} нүктесіне келдіңіз`;
    case "depart":
      return road ? `${road} көшесімен қозғалысты бастаңыз` : "Қозғалысты бастаңыз";
    case "turn":
    case "end of road":
      return `${direction} бұрылыңыз${roadText}`;
    case "roundabout":
    case "rotary":
      return `Айналма жолға кіріп${roadText} шығыңыз`;
    case "merge":
      return `${direction} бағыттағы жолға қосылыңыз${roadText}`;
    case "fork":
      return `${direction} бағытты ұстаныңыз${roadText}`;
    default:
      return road ? `${road} көшесімен ${direction} жүріңіз` : `${direction} жүріңіз`;
  }
}

export default function DriverNavigation({
  stops,
  onOpenStop,
}: {
  stops: NavigationStop[];
  onOpenStop: (stopId: string) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRouteRef = useRef<{ origin: [number, number]; signature: string } | null>(null);
  const fittedRouteRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [gpsState, setGpsState] = useState<"locating" | "active" | "denied" | "unavailable">("locating");
  const [routeError, setRouteError] = useState("");
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [steps, setSteps] = useState<DirectionsStep[]>([]);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);

  const navigableStops = useMemo(() => stops.filter((stop) => {
    const [longitude, latitude] = stop.coordinates ?? [];
    return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -85 && latitude <= 85;
  }), [stops]);
  const nextStop = navigableStops[0];
  const stopSignature = useMemo(
    () => navigableStops.map((stop) => `${stop.id}:${stop.coordinates.join(",")}`).join("|"),
    [navigableStops],
  );
  const origin = position?.coordinates ?? previewOrigin;
  const directDistance = nextStop ? distanceBetween(origin, nextStop.coordinates) : 0;
  const hasArrived = Boolean(nextStop && (arrivedAt === nextStop.id || (position && directDistance <= 140)));

  useEffect(() => {
    if (!nextStop || arrivedAt === nextStop.id) return;
    setArrivedAt(null);
  }, [arrivedAt, nextStop]);

  const activateGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsState("unavailable");
      return;
    }
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ coordinates: [coords.longitude, coords.latitude], accuracy: coords.accuracy, heading: coords.heading });
        setGpsState("active");
      },
      (error) => setGpsState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 },
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsState("unavailable");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({ coordinates: [coords.longitude, coords.latitude], accuracy: coords.accuracy, heading: coords.heading });
        setGpsState("active");
      },
      (error) => setGpsState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!token || !mapElement.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapElement.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: nextStop?.coordinates ?? previewOrigin,
      zoom: 12.5,
      pitch: 34,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => setMapReady(true));
    map.on("error", () => setRouteError("Карта жүктелмеді. Mapbox кілтін тексеріңіз."));
    mapRef.current = map;
    return () => {
      stopMarkersRef.current.forEach((marker) => marker.remove());
      driverMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [nextStop?.coordinates, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    stopMarkersRef.current.forEach((marker) => marker.remove());
    stopMarkersRef.current = navigableStops.map((stop, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `nav-stop-marker${index === 0 ? " next" : ""}`;
      element.innerHTML = `<span>${index + 1}</span>`;
      element.setAttribute("aria-label", `${index + 1}. ${stop.name}`);
      element.addEventListener("click", () => onOpenStop(stop.id));
      return new mapboxgl.Marker({ element, anchor: "bottom" })
        .setLngLat(stop.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 22, closeButton: false }).setText(`${stop.name} · ${stop.address}`))
        .addTo(map);
    });
  }, [mapReady, navigableStops, onOpenStop, stopSignature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !position) return;
    if (!driverMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "driver-location-marker";
      element.innerHTML = "<span>➤</span>";
      driverMarkerRef.current = new mapboxgl.Marker({ element, rotationAlignment: "map", pitchAlignment: "map" }).addTo(map);
    }
    driverMarkerRef.current.setLngLat(position.coordinates).setRotation(position.heading ?? 0);
  }, [mapReady, position]);

  useEffect(() => {
    const map = mapRef.current;
    if (!token || !map || !mapReady || navigableStops.length === 0) return;
    const previous = lastRouteRef.current;
    if (previous?.signature === stopSignature && distanceBetween(previous.origin, origin) < 45) return;
    lastRouteRef.current = { origin, signature: stopSignature };
    const controller = new AbortController();
    const coordinates = [origin, ...navigableStops.slice(0, 24).map((stop) => stop.coordinates)]
      .map((coordinate) => coordinate.join(","))
      .join(";");
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}?alternatives=false&continue_straight=true&geometries=geojson&overview=full&steps=true&banner_instructions=true&access_token=${encodeURIComponent(token)}`;
    setRouteError("");
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as DirectionsResponse;
        if (!response.ok || !data.routes?.[0]) throw new Error(data.message || "Маршрут табылмады");
        return data.routes[0];
      })
      .then((route) => {
        if (mapRef.current !== map) return;
        try {
          const feature = {
            type: "Feature" as const,
            properties: {},
            geometry: route.geometry,
          };
          const source = map.getSource("driver-route") as mapboxgl.GeoJSONSource | undefined;
          if (source) source.setData(feature);
          else {
            map.addSource("driver-route", { type: "geojson", data: feature });
            map.addLayer({
              id: "driver-route-outline",
              type: "line",
              source: "driver-route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.92 },
            });
            map.addLayer({
              id: "driver-route-line",
              type: "line",
              source: "driver-route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#139748", "line-width": 5.5 },
            });
          }
          const firstLeg = route.legs[0];
          setSummary({
            totalDistance: route.distance,
            totalDuration: route.duration,
            nextDistance: firstLeg?.distance ?? route.distance,
            nextDuration: firstLeg?.duration ?? route.duration,
          });
          setSteps(firstLeg?.steps ?? []);
          if (fittedRouteRef.current !== stopSignature) {
            const bounds = new mapboxgl.LngLatBounds();
            route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate as [number, number]));
            map.fitBounds(bounds, { padding: { top: 98, right: 44, bottom: 92, left: 44 }, maxZoom: 15, duration: 850 });
            fittedRouteRef.current = stopSignature;
          }
        } catch (error) {
          setRouteError(error instanceof Error ? error.message : "Картаға маршрутты шығару мүмкін болмады");
        }
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setRouteError(error.message || "Маршрутты құру мүмкін болмады");
      });
    return () => controller.abort();
  }, [mapReady, navigableStops, origin, stopSignature, token]);

  const centerOnDriver = () => {
    const map = mapRef.current;
    if (!map) return;
    const center = position?.coordinates ?? nextStop?.coordinates;
    if (center) map.easeTo({ center, zoom: position ? 16.5 : 14, pitch: position ? 52 : 30, bearing: position?.heading ?? 0, duration: 650 });
    if (!position) activateGps();
  };

  if (!nextStop) {
    return <section className="navigation-complete"><span>✓</span><strong>Бүгінгі жеткізулер аяқталды</strong><small>Барлық қабылданған тапсырыс дүкендерге жеткізілді.</small></section>;
  }

  const firstStep = steps.find((step) => step.distance > 8) ?? steps[0];
  const gpsLabel = gpsState === "active"
    ? `GPS қосулы · дәлдік ${Math.round(position?.accuracy ?? 0)} м`
    : gpsState === "locating"
      ? "GPS орны анықталуда…"
      : gpsState === "denied"
        ? "GPS рұқсаты өшірулі"
        : "GPS сигналы жоқ";

  return <section className="driver-navigation">
    <div className="driver-map-wrap">
      {token ? <div ref={mapElement} className="driver-map" aria-label="Экспедитордың белсенді навигация картасы" /> : <div className="driver-map-missing"><span>⌖</span><strong>Mapbox картасы дайын емес</strong><small>Vercel-де NEXT_PUBLIC_MAPBOX_TOKEN мәнін қосып, жобаны қайта жариялаңыз.</small></div>}
      <div className="nav-maneuver-card">
        <span>{maneuverIcon(firstStep)}</span>
        <div><b>{firstStep ? formatDistance(firstStep.distance) : summary ? formatDistance(summary.nextDistance) : "Маршрут"}</b><strong>{maneuverText(firstStep, nextStop.name)}</strong></div>
      </div>
      <button className={`gps-follow ${gpsState === "active" ? "active" : ""}`} onClick={centerOnDriver} aria-label="Картадан өз орнымды көрсету">⌖</button>
      {routeError && <div className="route-error">{routeError}</div>}
    </div>
    <div className="navigation-stats">
      <span><small>Келесі нүктеге</small><strong>{summary ? formatDuration(summary.nextDuration) : "—"}</strong></span>
      <span><small>Қашықтық</small><strong>{summary ? formatDistance(summary.nextDistance) : "—"}</strong></span>
      <span><small>Барлық маршрут</small><strong>{summary ? formatDistance(summary.totalDistance) : "—"}</strong></span>
    </div>
    <div className="gps-status-row"><span className={gpsState}>{gpsLabel}</span>{gpsState !== "active" && <button onClick={activateGps}>Қосу</button>}</div>
    <article className={`navigation-next-stop ${hasArrived ? "arrived" : ""}`}>
      <div className="navigation-stop-number">1</div>
      <div className="navigation-stop-copy"><small>{hasArrived ? "Сіз нүктеге келдіңіз" : "Келесі тоқтау"}</small><strong>{nextStop.name}</strong><span>{nextStop.address}</span><em>{nextStop.time} дейін</em></div>
      <button onClick={() => hasArrived ? onOpenStop(nextStop.id) : setArrivedAt(nextStop.id)}>{hasArrived ? "Тапсырысты ашу" : "Келдім"}</button>
    </article>
    <p className="navigation-safety">Қозғалыс кезінде телефонды ұстамаңыз. Нұсқаулықтарды жол қауіпсіздігіне сай орындаңыз.</p>
  </section>;
}
