import { Siren } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { formatNumber } from '@/lib/format';
import type { ApproachSnapshot, EmergencyPriorityStatus } from '@/lib/traffic/types';

interface EmergencyPanelProps {
  approaches: ApproachSnapshot[];
  emergency: EmergencyPriorityStatus | null;
  clearances: number;
  canOperate: boolean;
  onRequest: (approachId: string) => void;
  onCancel: () => void;
}

export function EmergencyPanel({ approaches, emergency, clearances, canOperate, onRequest, onCancel }: EmergencyPanelProps) {
  return (
    <Panel
      title="Emergency priority"
      description="Simulates an emergency vehicle asking for a clear path. The signal finishes a safe yellow and all-red, holds green for the vehicle, then returns to normal control. No real vehicle or signal is connected."
    >
      <div className="space-y-4">
        {emergency ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 px-4 py-3">
            <p className="text-sm font-medium text-rose-900">
              {emergency.stage === 'serving'
                ? `Clear path active for ${emergency.approachName}`
                : `Waiting to clear ${emergency.approachName}`}
            </p>
            {canOperate && (
              <Button variant="secondary" onClick={onCancel}>
                Cancel request
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No emergency vehicle is requesting priority.</p>
        )}

        {canOperate && (
          <div className="grid gap-2 sm:grid-cols-2">
            {approaches.map((approach) => (
              <Button
                key={approach.id}
                variant="secondary"
                disabled={emergency?.approachId === approach.id}
                onClick={() => onRequest(approach.id)}
              >
                <Siren className="h-4 w-4 text-rose-600" aria-hidden="true" />
                Clear path from {approach.name}
              </Button>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500">Completed clearances in this run: {formatNumber(clearances)}</p>
      </div>
    </Panel>
  );
}
