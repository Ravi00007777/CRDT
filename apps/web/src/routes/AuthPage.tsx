import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Logo } from '../components/Logo';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const [name, email, password] = ['name', 'email', 'password'].map((k) => String(f.get(k) ?? ''));
    setBusy(true);
    setError('');
    try {
      await (isLogin ? login(email, password) : register(name, email, password));
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-ink/40 focus:ring-4 focus:ring-ink/5';

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center"><Logo /></div>
        <h1 className="font-serif text-3xl">{isLogin ? 'Welcome back' : 'Start writing together'}</h1>
        <p className="mt-2 text-sm text-muted">{isLogin ? 'Sign in to your documents.' : 'Create an account in seconds.'}</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {!isLogin && (
            <label className="block text-sm font-medium">Name
              <input name="name" required maxLength={80} autoComplete="name" className={input} />
            </label>
          )}
          <label className="block text-sm font-medium">Email
            <input name="email" type="email" required autoComplete="email" className={input} />
          </label>
          <label className="block text-sm font-medium">Password
            <input name="password" type="password" required minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} className={input} />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-ink py-2.5 font-medium text-white hover:bg-black disabled:opacity-60">
            {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <Link to={isLogin ? '/register' : '/login'} state={{ from }} className="font-medium text-ink underline underline-offset-2">
            {isLogin ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </div>
    </main>
  );
}
