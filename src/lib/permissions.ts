import type { UserRole } from '@/types/database';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  traffic_operator: 'Traffic Control Operator',
  traffic_analyst: 'Traffic Analyst',
  viewer: 'General Viewer',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Full control over intersections, users, and simulations.',
  traffic_operator: 'Monitors intersections and runs signal simulations.',
  traffic_analyst: 'Runs comparisons and reviews analytics and saved runs.',
  viewer: 'Read-only access to dashboards and intersection information.',
};

export const CAN_MANAGE_INTERSECTIONS: UserRole[] = ['super_admin'];
export const CAN_RUN_SIMULATION: UserRole[] = ['super_admin', 'traffic_operator', 'traffic_analyst'];
export const CAN_VIEW_ANALYTICS: UserRole[] = ['super_admin', 'traffic_analyst'];
export const CAN_MANAGE_USERS: UserRole[] = ['super_admin'];
export const CAN_MANAGE_INCIDENTS: UserRole[] = ['super_admin', 'traffic_operator'];
export const CAN_DELETE_INCIDENTS: UserRole[] = ['super_admin'];
