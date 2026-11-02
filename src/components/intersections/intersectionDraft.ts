import type { ApproachName, ControlMode, PhaseGroup } from '@/lib/traffic/types';
import type { IntersectionRow } from '@/types/database';
import type { IntersectionWithApproaches } from '@/hooks/useIntersections';

export const APPROACH_NAMES: ApproachName[] = ['North', 'East', 'South', 'West'];

export interface ApproachDraft {
  name: ApproachName;
  road_name: string;
  lanes: string;
  phase_group: PhaseGroup;
  base_arrival_rate: string;
  saturation_flow_vph: string;
}

export interface IntersectionDraft {
  code: string;
  name: string;
  city: string;
  latitude: string;
  longitude: string;
  status: 'active' | 'inactive';
  control_mode: ControlMode;
  min_green_seconds: string;
  max_green_seconds: string;
  yellow_seconds: string;
  all_red_seconds: string;
  fixed_green_seconds: string;
  approaches: ApproachDraft[];
}

export interface ValidIntersectionValues {
  intersection: {
    code: string;
    name: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    status: 'active' | 'inactive';
    control_mode: ControlMode;
    min_green_seconds: number;
    max_green_seconds: number;
    yellow_seconds: number;
    all_red_seconds: number;
    fixed_green_seconds: number;
  };
  approaches: (Omit<ApproachDraft, 'lanes' | 'base_arrival_rate' | 'saturation_flow_vph'> & {
    lanes: number;
    base_arrival_rate: number;
    saturation_flow_vph: number;
  })[];
}

export type DraftValidation =
  | { ok: true; values: ValidIntersectionValues }
  | { ok: false; errors: Record<string, string> };

const DEFAULT_APPROACH_PHASE: Record<ApproachName, PhaseGroup> = {
  North: 'A',
  South: 'A',
  East: 'B',
  West: 'B',
};

export function createEmptyDraft(): IntersectionDraft {
  return {
    code: '',
    name: '',
    city: '',
    latitude: '',
    longitude: '',
    status: 'active',
    control_mode: 'adaptive',
    min_green_seconds: '10',
    max_green_seconds: '60',
    yellow_seconds: '3',
    all_red_seconds: '2',
    fixed_green_seconds: '30',
    approaches: APPROACH_NAMES.map((name) => ({
      name,
      road_name: '',
      lanes: '2',
      phase_group: DEFAULT_APPROACH_PHASE[name],
      base_arrival_rate: '12',
      saturation_flow_vph: '1800',
    })),
  };
}

export function draftFromIntersection(intersection: IntersectionWithApproaches): IntersectionDraft {
  const approachByName = new Map(intersection.approaches.map((approach) => [approach.name, approach]));
  return {
    code: intersection.code,
    name: intersection.name,
    city: intersection.city,
    latitude: intersection.latitude === null ? '' : String(intersection.latitude),
    longitude: intersection.longitude === null ? '' : String(intersection.longitude),
    status: intersection.status,
    control_mode: intersection.control_mode,
    min_green_seconds: String(intersection.min_green_seconds),
    max_green_seconds: String(intersection.max_green_seconds),
    yellow_seconds: String(intersection.yellow_seconds),
    all_red_seconds: String(intersection.all_red_seconds),
    fixed_green_seconds: String(intersection.fixed_green_seconds),
    approaches: APPROACH_NAMES.map((name) => {
      const existing = approachByName.get(name);
      return {
        name,
        road_name: existing?.road_name ?? '',
        lanes: String(existing?.lanes ?? 2),
        phase_group: existing?.phase_group ?? DEFAULT_APPROACH_PHASE[name],
        base_arrival_rate: String(existing?.base_arrival_rate ?? 12),
        saturation_flow_vph: String(existing?.saturation_flow_vph ?? 1800),
      };
    }),
  };
}

function parseWholeNumber(value: string, min: number, max: number): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
}

function parseDecimal(value: string, min: number, max: number): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function isTextLengthInRange(value: string, min: number, max: number): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

export function validateDraft(draft: IntersectionDraft): DraftValidation {
  const errors: Record<string, string> = {};
  const code = draft.code.trim().toUpperCase();

  if (!/^[A-Z0-9-]{3,20}$/.test(code)) errors.code = 'Use 3-20 letters, digits, or hyphens.';
  if (!isTextLengthInRange(draft.name, 2, 120)) errors.name = 'Enter a name between 2 and 120 characters.';
  if (!isTextLengthInRange(draft.city, 2, 80)) errors.city = 'Enter a city between 2 and 80 characters.';

  const latitude = draft.latitude.trim() === '' ? null : parseDecimal(draft.latitude, -90, 90);
  if (draft.latitude.trim() !== '' && latitude === null) errors.latitude = 'Latitude must be between -90 and 90.';
  const longitude = draft.longitude.trim() === '' ? null : parseDecimal(draft.longitude, -180, 180);
  if (draft.longitude.trim() !== '' && longitude === null) errors.longitude = 'Longitude must be between -180 and 180.';

  const minGreen = parseWholeNumber(draft.min_green_seconds, 5, 120);
  const maxGreen = parseWholeNumber(draft.max_green_seconds, 10, 180);
  const yellow = parseWholeNumber(draft.yellow_seconds, 2, 6);
  const allRed = parseWholeNumber(draft.all_red_seconds, 0, 5);
  const fixedGreen = parseWholeNumber(draft.fixed_green_seconds, 5, 180);
  if (minGreen === null) errors.min_green_seconds = 'Minimum green must be 5-120 seconds.';
  if (maxGreen === null) errors.max_green_seconds = 'Maximum green must be 10-180 seconds.';
  if (minGreen !== null && maxGreen !== null && maxGreen < minGreen) {
    errors.max_green_seconds = 'Maximum green cannot be less than minimum green.';
  }
  if (yellow === null) errors.yellow_seconds = 'Yellow must be 2-6 seconds.';
  if (allRed === null) errors.all_red_seconds = 'All-red clearance must be 0-5 seconds.';
  if (fixedGreen === null) errors.fixed_green_seconds = 'Fixed-plan green must be 5-180 seconds.';

  const approaches: ValidIntersectionValues['approaches'] = [];
  for (const approach of draft.approaches) {
    const lanes = parseWholeNumber(approach.lanes, 1, 6);
    const arrivalRate = parseDecimal(approach.base_arrival_rate, 0, 60);
    const saturation = parseWholeNumber(approach.saturation_flow_vph, 600, 2400);
    if (!isTextLengthInRange(approach.road_name, 2, 120)) {
      errors[`approach:${approach.name}:road_name`] = 'Enter the road name.';
    }
    if (lanes === null) errors[`approach:${approach.name}:lanes`] = 'Lanes must be 1-6.';
    if (arrivalRate === null) errors[`approach:${approach.name}:base_arrival_rate`] = 'Arrival rate must be 0-60.';
    if (saturation === null) errors[`approach:${approach.name}:saturation_flow_vph`] = 'Saturation flow must be 600-2400.';
    if (lanes !== null && arrivalRate !== null && saturation !== null) {
      approaches.push({
        ...approach,
        road_name: approach.road_name.trim(),
        lanes,
        base_arrival_rate: arrivalRate,
        saturation_flow_vph: saturation,
      });
    }
  }

  const groups = new Set(draft.approaches.map((approach) => approach.phase_group));
  if (!groups.has('A') || !groups.has('B')) {
    errors.approaches = 'Assign at least one approach to each phase group so conflicting roads never share green.';
  }

  if (Object.keys(errors).length > 0 || minGreen === null || maxGreen === null || yellow === null || allRed === null || fixedGreen === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      intersection: {
        code,
        name: draft.name.trim(),
        city: draft.city.trim(),
        latitude,
        longitude,
        status: draft.status,
        control_mode: draft.control_mode,
        min_green_seconds: minGreen,
        max_green_seconds: maxGreen,
        yellow_seconds: yellow,
        all_red_seconds: allRed,
        fixed_green_seconds: fixedGreen,
      },
      approaches,
    },
  };
}

export function intersectionLabel(intersection: Pick<IntersectionRow, 'code' | 'name'>): string {
  return `${intersection.name} (${intersection.code})`;
}
