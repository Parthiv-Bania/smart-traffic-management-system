import { AlertTriangle, MapPin, Siren } from 'lucide-react';
import type { MapLayers } from '@/components/map/TrafficMap';

interface MapLayerTogglesProps {
  layers: MapLayers;
  counts: { intersections: number; incidents: number; emergencies: number };
  onChange: (layers: MapLayers) => void;
}

const LAYER_OPTIONS: { key: keyof MapLayers; label: string; icon: typeof MapPin }[] = [
  { key: 'intersections', label: 'Intersections', icon: MapPin },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'emergencies', label: 'Emergency vehicles', icon: Siren },
];

export function MapLayerToggles({ layers, counts, onChange }: MapLayerTogglesProps) {
  return (
    <div role="group" aria-label="Map layers" className="flex flex-wrap gap-2">
      {LAYER_OPTIONS.map(({ key, label, icon: Icon }) => {
        const pressed = layers[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange({ ...layers, [key]: !pressed })}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              pressed
                ? 'bg-slate-900 text-white ring-slate-900 hover:bg-slate-800'
                : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            <span className={`tabular-nums text-xs ${pressed ? 'text-slate-300' : 'text-slate-500'}`}>{counts[key]}</span>
          </button>
        );
      })}
    </div>
  );
}
