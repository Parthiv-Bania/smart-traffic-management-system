import { Suspense, useState, type ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  MapPin,
  ScrollText,
  Settings,
  TrafficCone,
  Users,
  X,
  type LucideProps,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/StatePanels';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { CAN_MANAGE_USERS, CAN_VIEW_ANALYTICS, ROLE_LABELS } from '@/lib/permissions';
import type { UserRole } from '@/types/database';
import { AboutDeveloper } from '../profile/AboutDeveloper';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  roles?: UserRole[];
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/intersections', label: 'Intersections', icon: TrafficCone },
  { to: '/map', label: 'Traffic Map', icon: MapPin },
  { to: '/simulation', label: 'Live Simulation', icon: MonitorPlay },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: CAN_VIEW_ANALYTICS },
  { to: '/users', label: 'User Management', icon: Users, roles: CAN_MANAGE_USERS },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, roles: CAN_MANAGE_USERS },
  { to: '/settings', label: 'System Settings', icon: Settings, roles: CAN_MANAGE_USERS },
];

function SidebarContent({ organizationName, onNavigate }: { organizationName: string; onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (profile && item.roles.includes(profile.role)));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/40">
          <Activity className="h-5 w-5 text-sky-300" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">STMS</p>
          <p className="text-xs text-slate-400">{organizationName}</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-4 py-4">
        <p className="truncate text-sm font-medium text-slate-100">{profile?.full_name || profile?.email}</p>
        <p className="mt-0.5 text-xs text-slate-400">{profile ? ROLE_LABELS[profile.role] : ''}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { settings } = useSystemSettings();
  const organizationName = settings?.organization_name ?? 'Traffic Control Centre';

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 lg:block print:hidden">
        <SidebarContent organizationName={organizationName} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 shadow-xl">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent organizationName={organizationName} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-sm font-semibold text-slate-900">{organizationName}</span>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          <Suspense fallback={<LoadingState label="Loading page" />}>
            <Outlet />
          </Suspense>
          <AboutDeveloper />
        </main>
      </div>
    </div>
  );
}
