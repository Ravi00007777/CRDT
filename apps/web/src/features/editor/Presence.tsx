import { Avatar } from '../../components/Avatar';
import type { ConnStatus, Peer } from './useCollab';

const STATUS: Record<ConnStatus, { label: string; dot: string }> = {
  connected: { label: 'Live', dot: 'bg-emerald-500' },
  connecting: { label: 'Connecting…', dot: 'bg-amber-400 animate-pulse' },
  disconnected: { label: 'Offline — edits saved locally', dot: 'bg-red-500' },
};

export function ConnectionBadge({ status, synced }: { status: ConnStatus; synced: boolean }) {
  const s = status === 'connected' && !synced ? { label: 'Syncing…', dot: 'bg-amber-400 animate-pulse' } : STATUS[status];
  return (
    <span data-testid="connection-status" data-status={status} className="flex items-center gap-1.5 text-xs text-muted" role="status">
      <span className={`size-2 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

/** One avatar per person (multiple tabs of the same user collapse into one). */
export function PresenceStack({ peers, selfId }: { peers: Peer[]; selfId: string }) {
  const people = [...new Map(peers.map((p) => [p.id, p])).values()].sort((a, b) => (a.id === selfId ? -1 : b.id === selfId ? 1 : 0));
  return (
    <div className="flex items-center" data-testid="presence" aria-label={`${people.length} people here`}>
      <div className="flex -space-x-2">
        {people.slice(0, 5).map((p) => (
          <span key={p.id} data-testid="presence-user" data-name={p.name}>
            <Avatar id={p.id} name={p.id === selfId ? `${p.name} (you)` : p.name} size="sm" ring />
          </span>
        ))}
      </div>
      {people.length > 5 && <span className="ml-1 text-xs text-muted">+{people.length - 5}</span>}
    </div>
  );
}
