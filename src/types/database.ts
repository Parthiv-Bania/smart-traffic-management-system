import type { ApproachName, ControlMode, PhaseGroup, SimulationMetrics } from '@/lib/traffic/types';

export type UserRole = 'super_admin' | 'traffic_operator' | 'traffic_analyst' | 'viewer';

export const USER_ROLES: UserRole[] = ['super_admin', 'traffic_operator', 'traffic_analyst', 'viewer'];

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface IntersectionRow {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export interface ApproachRow {
  id: string;
  intersection_id: string;
  name: ApproachName;
  road_name: string;
  lanes: number;
  phase_group: PhaseGroup;
  saturation_flow_vph: number;
  base_arrival_rate: number;
}

export interface SimulationRunRow {
  id: string;
  intersection_id: string;
  comparison_id: string | null;
  control_mode: ControlMode;
  duration_seconds: number;
  random_seed: number;
  traffic_intensity: number;
  metrics: SimulationMetrics;
  created_at: string;
}
