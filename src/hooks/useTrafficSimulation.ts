import { useCallback, useEffect, useRef, useState } from 'react';
import { IntersectionSimulation } from '@/lib/traffic/intersectionSimulation';
import type { SimulationConfig, SimulationSnapshot } from '@/lib/traffic/types';

export type SimulationStatus = 'stopped' | 'running' | 'paused';
export const SIMULATION_SPEEDS = [1, 2, 5, 10] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

const TICK_INTERVAL_MS = 500;

export function useTrafficSimulation(config: SimulationConfig | null) {
  const simulationRef = useRef<IntersectionSimulation | null>(null);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [status, setStatus] = useState<SimulationStatus>('stopped');
  const [speed, setSpeed] = useState<SimulationSpeed>(1);

  const reset = useCallback(() => {
    if (!config) {
      simulationRef.current = null;
      setSnapshot(null);
      setStatus('stopped');
      return;
    }
    const simulation = new IntersectionSimulation(config);
    simulationRef.current = simulation;
    setSnapshot(simulation.snapshot());
    setStatus('stopped');
  }, [config]);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (status !== 'running') return;
    let pendingSeconds = 0;
    const intervalId = window.setInterval(() => {
      const simulation = simulationRef.current;
      if (!simulation) return;
      pendingSeconds += (speed * TICK_INTERVAL_MS) / 1000;
      const wholeSeconds = Math.floor(pendingSeconds);
      pendingSeconds -= wholeSeconds;
      simulation.advance(wholeSeconds);
      setSnapshot(simulation.snapshot());
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [status, speed]);

  const setDetectorOnline = useCallback((approachId: string, online: boolean) => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    simulation.setDetectorOnline(approachId, online);
    setSnapshot(simulation.snapshot());
  }, []);

  const requestEmergency = useCallback((approachId: string): boolean => {
    const simulation = simulationRef.current;
    if (!simulation || !simulation.requestEmergencyPriority(approachId)) return false;
    setSnapshot(simulation.snapshot());
    return true;
  }, []);

  const cancelEmergency = useCallback(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    simulation.cancelEmergencyPriority();
    setSnapshot(simulation.snapshot());
  }, []);

  return {
    snapshot,
    status,
    speed,
    setSpeed,
    start: () => setStatus('running'),
    pause: () => setStatus('paused'),
    resume: () => setStatus('running'),
    stop: () => setStatus('stopped'),
    reset,
    setDetectorOnline,
    requestEmergency,
    cancelEmergency,
  };
}
