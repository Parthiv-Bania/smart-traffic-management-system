export function formatSeconds(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  if (seconds % 3600 === 0 && seconds > 0) return `${seconds / 3600} h`;
  return `${Math.round(seconds / 60)} min`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}
