'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/components/dashboard/AuthProvider';

function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user && pathname !== '/dashboard/login') {
      router.replace('/dashboard/login');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user || pathname === '/dashboard/login') return null;

  const links = [
    { href: '/dashboard',           label: 'Overview',   icon: '▦' },
    { href: '/dashboard/incidents', label: 'Incidents',  icon: '⚠' },
    { href: '/dashboard/incidents/new', label: 'Log Incident', icon: '+' },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-lg">◈</span>
          <span className="font-bold text-gray-100 text-sm tracking-wider uppercase">PhishGuard</span>
        </div>
        <p className="text-gray-500 text-xs mt-1">Incident Dashboard</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ href, label, icon }) => {
          const active = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              }`}
            >
              <span className="w-4 text-center text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="mb-3">
          <p className="text-gray-100 text-sm truncate">{profile?.full_name ?? user.email}</p>
          <p className="text-gray-500 text-xs mt-0.5 capitalize">{profile?.role ?? 'analyst'}</p>
        </div>
        <button
          onClick={signOut}
          className="w-full text-left text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const isLogin = pathname === '/dashboard/login';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className={user && !isLogin ? 'ml-56 p-8' : ''}>
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
