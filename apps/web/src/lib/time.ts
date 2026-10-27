const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, secs] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  }
  return 'just now';
}
