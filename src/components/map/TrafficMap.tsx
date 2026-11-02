import { useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { divIcon, latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapIntersection {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  latitude: number;
  longitude: number;
}

export interface MapLayers {
  intersections: boolean;
  incidents: boolean;
  emergencies: boolean;
}

interface TrafficMapProps {
  intersections: MapIntersection[];
  incidentCounts: Record<string, number>;
  emergencyApproaches: Record<string, string[]>;
  layers: MapLayers;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function intersectionIcon(status: MapIntersection['status'], selected: boolean) {
  const dotTone = status === 'active' ? 'bg-sky-600' : 'bg-slate-400';
  const ring = selected ? 'ring-4 ring-sky-300' : 'ring-2 ring-white';
  return divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `<span class="block h-7 w-7 rounded-full ${dotTone} ${ring} shadow-md transition-transform duration-150 hover:scale-110"></span>`,
  });
}

function incidentBadgeIcon(count: number) {
  const width = count > 9 ? 26 : 20;
  return divIcon({
    className: '',
    iconSize: [width, 20],
    iconAnchor: [0, 20],
    html: `<span class="flex h-5 w-full items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-slate-900 shadow ring-2 ring-white">${count}</span>`,
  });
}

function emergencyRingIcon() {
  return divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: '<span class="relative block h-full w-full"><span class="absolute inset-0 animate-ping rounded-full bg-rose-500/60"></span><span class="absolute inset-0 rounded-full ring-2 ring-rose-500"></span></span>',
  });
}

function FitToIntersections({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    map.fitBounds(latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
  }, [map, points]);
  return null;
}

function FocusOnSelected({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat === null || lng === null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

export function TrafficMap({
  intersections,
  incidentCounts,
  emergencyApproaches,
  layers,
  selectedId,
  onSelect,
}: TrafficMapProps) {
  const points = intersections.map((item): [number, number] => [item.latitude, item.longitude]);
  const selected = intersections.find((item) => item.id === selectedId) ?? null;

  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      scrollWheelZoom
      className="h-[420px] w-full rounded-xl sm:h-[560px]"
      aria-label="Map of monitored intersections"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <FitToIntersections points={points} />
      <FocusOnSelected lat={selected?.latitude ?? null} lng={selected?.longitude ?? null} />

      {layers.emergencies &&
        intersections
          .filter((item) => (emergencyApproaches[item.id]?.length ?? 0) > 0)
          .map((item) => (
            <Marker
              key={`emergency-${item.id}`}
              position={[item.latitude, item.longitude]}
              icon={emergencyRingIcon()}
              interactive={false}
              zIndexOffset={-100}
            />
          ))}

      {layers.intersections &&
        intersections.map((item) => {
          const incidentCount = incidentCounts[item.id] ?? 0;
          const approaches = emergencyApproaches[item.id] ?? [];
          return (
            <Marker
              key={item.id}
              position={[item.latitude, item.longitude]}
              icon={intersectionIcon(item.status, item.id === selectedId)}
              title={item.name}
              alt={item.name}
              eventHandlers={{ click: () => onSelect(item.id) }}
            >
              <Popup>
                <div className="min-w-44 space-y-1 text-slate-900">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-slate-600">{item.code}</p>
                  {layers.incidents && (
                    <p className="text-xs text-slate-700">
                      {incidentCount} active {incidentCount === 1 ? 'incident' : 'incidents'}
                    </p>
                  )}
                  {layers.emergencies && approaches.length > 0 && (
                    <p className="text-xs text-rose-800">Emergency priority on {approaches.join(', ')}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

      {layers.incidents &&
        intersections
          .filter((item) => (incidentCounts[item.id] ?? 0) > 0)
          .map((item) => (
            <Marker
              key={`incidents-${item.id}`}
              position={[item.latitude, item.longitude]}
              icon={incidentBadgeIcon(incidentCounts[item.id])}
              zIndexOffset={500}
              title={`${incidentCounts[item.id]} active incidents at ${item.name}`}
              alt={`${incidentCounts[item.id]} active incidents at ${item.name}`}
              eventHandlers={{ click: () => onSelect(item.id) }}
            />
          ))}
    </MapContainer>
  );
}
