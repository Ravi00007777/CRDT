import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

export function AppHeader({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">{children ?? <Logo />}</div>
        <div className="flex items-center gap-2 sm:gap-3">
          {user && <span className={children ? 'hidden sm:inline-flex' : 'inline-flex'}><Avatar id={user.id} name={user.name} /></span>}
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-black/5 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
