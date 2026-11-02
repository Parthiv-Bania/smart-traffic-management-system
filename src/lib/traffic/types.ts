export type ApproachName = 'North' | 'South' | 'East' | 'West';
export type PhaseGroup = 'A' | 'B';
export type SignalPhaseState = 'GREEN' | 'YELLOW' | 'ALL_RED';
export type ApproachSignal = 'GREEN' | 'YELLOW' | 'RED';
export type ControlMode = 'fixed' | 'adaptive';
export type DensityLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface ApproachConfig {
  id: string;
  name: ApproachName;
  roadName: string;
  lanes: number;
  phaseGroup: PhaseGroup;
  saturationFlowVph: number;
  baseArrivalRate: number;
}

export interface TimingConfig {
  minGreenSeconds: number;
  maxGreenSeconds: number;
  yellowSeconds: number;
  allRedSeconds: number;
  fixedGreenSeconds: number;
}

export interface DemandWeights {
  count: number;
  queue: number;
  wait: number;
}

export interface SimulationConfig {
  approaches: ApproachConfig[];
  timing: TimingConfig;
  controlMode: ControlMode;
  trafficIntensity: number;
  randomSeed: number;
  weights?: DemandWeights;
}

export interface SignalPhase {
  group: PhaseGroup;
  state: SignalPhaseState;
}

export interface ApproachObservation {
  approach: ApproachName;
  queue: number;
  approachingCount: number;
  waitSeconds: number;
}

export interface DecisionLogEntry {
  sequence: number;
  simTime: number;
  previousPhase: SignalPhase | null;
  newPhase: SignalPhase;
  observations: ApproachObservation[];
  greenSeconds: number;
  controlMode: ControlMode;
  reason: string;
}

export interface ApproachSnapshot {
  id: string;
  name: ApproachName;
  roadName: string;
  lanes: number;
  phaseGroup: PhaseGroup;
  queue: number;
  approachingCount: number;
  waitSeconds: number;
  occupancy: number;
  density: DensityLevel;
  signal: ApproachSignal;
  arrivalsTotal: number;
  servedTotal: number;
}

export interface SignalSnapshot {
  activePhase: SignalPhase;
  elapsedSeconds: number;
  greenTargetSeconds: number;
}

export interface SimulationMetrics {
  vehiclesDetected: number;
  vehiclesServed: number;
  currentQueue: number;
  averageDelaySeconds: number;
  averageQueueLength: number;
  throughputVehiclesPerHour: number;
  congestionSeconds: number;
  signalUtilization: number;
  fairnessIndex: number;
  emergencyClearances: number;
}

export interface TimelinePoint {
  minute: number;
  arrivals: number;
  served: number;
  queue: number;
  averageOccupancy: number;
}

export interface SimulationSnapshot {
  simTime: number;
  controlMode: ControlMode;
  signal: SignalSnapshot;
  approaches: ApproachSnapshot[];
  decisions: DecisionLogEntry[];
  timeline: TimelinePoint[];
  metrics: SimulationMetrics;
  emergency: EmergencyPriorityStatus | null;
}

export interface EmergencyRequest {
  approachId: string;
  approachName: ApproachName;
  phaseGroup: PhaseGroup;
}

export interface EmergencyPriorityStatus extends EmergencyRequest {
  stage: 'waiting' | 'serving';
}
