import { AlertTriangle, CheckCircle2, Info, Siren } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import type { ApproachSnapshot, EmergencyPriorityStatus } from '@/lib/traffic/types';

interface SimulationAlertsProps {
  approaches: ApproachSnapshot[];
  emergency: EmergencyPriorityStatus | null;
  offlineApproachNames: string[];
}

interface Alert {
  key: string;
  tone: 'danger' | 'warning' | 'info';
  message: string;
}

function buildAlerts({ approaches, emergency, offlineApproachNames }: SimulationAlertsProps): Alert[] {
  const alerts: Alert[] = [];
  for (const approach of approaches) {
    if (approach.density === 'Critical') {
      alerts.push({ key: `density-${approach.id}`, tone: 'danger', message: `${approach.name} approach is critically full with ${approach.queue} vehicles queued.` });
    } else if (approach.density === 'High') {
      alerts.push({ key: `density-${approach.id}`, tone: 'warning', message: `${approach.name} approach is filling up with ${approach.queue} vehicles queued.` });
    }
  }
  for (const name of offlineApproachNames) {
    alerts.push({ key: `detector-${name}`, tone: 'warning', message: `Detector offline on ${name}. That approach uses fixed timing until it is back.` });
  }
  if (emergency) {
    alerts.push({
      key: 'emergency',
      tone: emergency.stage === 'waiting' ? 'danger' : 'info',
      message:
        emergency.stage === 'waiting'
          ? `Emergency vehicle waiting to clear ${emergency.approachName}.`
          : `Clear path active for ${emergency.approachName}.`,
    });
  }
  return alerts;
}

const TONE_STYLES: Record<Alert['tone'], string> = {
  danger: 'bg-rose-50 text-rose-900',
  warning: 'bg-amber-50 text-amber-900',
  info: 'bg-sky-50 text-sky-900',
};

const TONE_ICON = {
  danger: Siren,
  warning: AlertTriangle,
  info: Info,
};

export function SimulationAlerts(props: SimulationAlertsProps) {
  const alerts = buildAlerts(props);
  return (
    <Panel title="Alerts" description="Raised from the live simulation state. Each alert clears on its own when the condition ends.">
      {alerts.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          No active alerts.
        </p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {alerts.map((alert) => {
            const Icon = TONE_ICON[alert.tone];
            return (
              <li key={alert.key} className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${TONE_STYLES[alert.tone]}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {alert.message}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
