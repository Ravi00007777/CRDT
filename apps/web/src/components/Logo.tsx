import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#1f2937" />
        <path d="M9 20c3 3 11 3 14-1M9 12c3-3 11-3 14 1" stroke="#fbbf24" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      SyncSpace
    </Link>
  );
}
