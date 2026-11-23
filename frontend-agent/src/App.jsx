import { useEffect, useState } from 'react';
import {
  LayoutDashboard, FilePlus2, ClipboardList, BarChart3, Users, Shield, FileText, BookOpen, LogOut, Menu, X, ChevronRight
} from 'lucide-react';
import LoginView from './components/LoginView.jsx';
import Dashboard from './pages/Dashboard.jsx';
import QuestionInput from './pages/QuestionInput.jsx';
import QuestionSheets from './pages/QuestionSheets.jsx';
import RoleManagement from './pages/RoleManagement.jsx';
import MapelManagement from './pages/MapelManagement.jsx';
import SystemReport from './pages/SystemReport.jsx';
import TryoutReport from './pages/TryoutReport.jsx';
import UserManagement from './pages/UserManagement.jsx';
import TryoutManagement from './pages/TryoutManagement.jsx';
import PesertaManagement from './pages/PesertaManagement.jsx';
import { getMe, logout } from './api.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const NAV_GROUPS = [
  {
    key: 'manajemen-soal',
    label: 'Manajemen Soal',
    items: [
      { path: '/questions', hash: '#/questions', label: 'Daftar Soal', permission: 'questions.read', icon: LayoutDashboard },
      { path: '/questions/new', hash: '#/questions/new', label: 'Input Soal', permission: 'questions.write', icon: FilePlus2 },
      { path: '/question-sheets', hash: '#/question-sheets', label: 'Lembar Soal', permission: 'question_sheets.manage', icon: FileText }
    ]
  },
  {
    key: 'manajemen-tryout',
    label: 'Manajemen Tryout',
    items: [
      { path: '/tryouts', hash: '#/tryouts', label: 'Buat/Daftar Tryout', permission: 'tryouts.manage', icon: ClipboardList },
      { path: '/tryouts/peserta', hash: '#/tryouts/peserta', label: 'Kelola Peserta', permission: 'tryouts.manage', icon: Users },
      { path: '/reports/tryout', hash: '#/reports/tryout', label: 'Laporan Tryout', permission: 'tryout_reports.read', icon: BarChart3 }
    ]
  },
  {
    key: 'setting',
    label: 'Setting',
      items: [
        { path: '/mapels', hash: '#/mapels', label: 'Kelola Mapel', permission: 'mapels.manage', icon: BookOpen },
        { path: '/roles', hash: '#/roles', label: 'Kelola Role', permission: 'roles.manage', icon: Shield },
        { path: '/reports/system', hash: '#/reports/system', label: 'Laporan Sistem', permission: 'reports.read', icon: FileText }
      ]
  }
];

const NAV_STANDALONE = [
  { path: '/users/new', hash: '#/users/new', label: 'Buat User', permission: 'roles.manage', icon: Users }
];

const NAV_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), ...NAV_STANDALONE];
const ROUTE_ALIASES = { '/': '/questions' };

function NavLink({ item, active, onNavigate }) {
  const Icon = item.icon;
  return (
    <a
      href={item.hash}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{item.label}</span>
    </a>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const route = useHashRoute();
  const activePath = ROUTE_ALIASES[route] ?? route;

  useEffect(() => {
    let active = true;
    getMe()
      .then((data) => { if (active) setSession(data); })
      .catch(() => { if (active) setSession(null); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [route]);

  const can = (permission) => Boolean(session?.permissions?.includes(permission));

  async function handleLogout() {
    try {
      await logout();
    } finally {
      window.location.hash = '/questions';
      setSession(null);
    }
  }

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center p-6"><Alert className="max-w-md">Memeriksa sesi…</Alert></div>;
  }

  if (!session) {
    return (
      <LoginView
        onLogin={() => getMe()
          .then((data) => setSession(data))
          .catch(() => setSession(null))}
      />
    );
  }

  const current = NAV_ITEMS.find((item) => item.path === activePath);
  let page;
  if (!current) {
    page = <div className="rounded-xl border bg-card p-6"><h2 className="text-lg font-semibold">Halaman tidak ditemukan</h2></div>;
  } else if (!can(current.permission)) {
    page = <div className="rounded-xl border bg-card p-6"><h2 className="text-lg font-semibold">Akses ditolak</h2>
      <p className="mt-2 text-sm text-muted-foreground">Akun Anda tidak memiliki permission {current.permission}.</p></div>;
  } else if (activePath === '/questions') {
    page = <Dashboard can={can} />;
  } else if (activePath === '/questions/new') {
    page = <QuestionInput />;
  } else if (activePath === '/question-sheets') {
    page = <QuestionSheets />;
  } else if (activePath === '/users/new') {
    page = <UserManagement can={can} />;
  } else if (activePath === '/tryouts') {
    page = <TryoutManagement />;
  } else if (activePath === '/tryouts/peserta') {
    page = <PesertaManagement />;
  } else if (activePath === '/mapels') {
    page = <MapelManagement />;
  } else if (activePath === '/roles') {
    page = <RoleManagement />;
  } else if (activePath === '/reports/system') {
    page = <SystemReport />;
  } else {
    page = <TryoutReport />;
  }

  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter((g) => g.items.length);
  const visibleStandalone = NAV_STANDALONE.filter((i) => can(i.permission));
  const breadcrumbs = current ? [NAV_GROUPS.find((g) => g.items.some((i) => i.path === current.path))?.label, current.label].filter(Boolean) : ['CMS'];

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">BS</div>
          <div>
            <div className="text-sm font-semibold leading-none">Bank Soal</div>
            <div className="text-xs text-muted-foreground">CMS Admin</div>
          </div>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{group.label}</div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink key={item.path} item={item} active={activePath === item.path} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        ))}
        {visibleStandalone.length > 0 && (
          <div>
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">User</div>
            <div className="space-y-1">
              {visibleStandalone.map((item) => (
                <NavLink key={item.path} item={item} active={activePath === item.path} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        )}
      </nav>
      <Separator />
      <div className="p-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-sm font-medium truncate">{session.user.username}</div>
          <div className="mb-2 flex flex-wrap gap-1 mt-1">
            {(session.roles ?? []).map((r) => <Badge key={r} variant="secondary" className="text-[10px] px-1.5 py-0">{r}</Badge>)}
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleLogout}><LogOut className="h-4 w-4" />Keluar</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r bg-background shadow-xl">
            <button className="absolute right-3 top-4 rounded-md p-1 hover:bg-accent" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((b, i) => (
              <span key={b} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                <span className={i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}>{b}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">{session.user.username}</Badge>
          </div>
        </header>
        <main className="p-4 sm:p-6 space-y-6">{page}</main>
      </div>
    </div>
  );
}
