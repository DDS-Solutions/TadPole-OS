/**
 * @module App
 * Root application component.
 * Defines all route mappings, wraps lazy-loaded pages in Suspense + ErrorBoundary,
 * and synchronizes provider defaults on mount.
 */
import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useProviderStore } from './services/providerStore';
import { getSettings } from './services/settingsStore';
import DashboardLayout from './layouts/DashboardLayout';
import OpsDashboard from './pages/OpsDashboard';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded pages — only downloaded when the user navigates to them
const OrgChart = lazy(() => import('./pages/OrgChart'));
const Standups = lazy(() => import('./pages/Standups'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const Docs = lazy(() => import('./pages/Docs'));
const Settings = lazy(() => import('./pages/Settings'));
const OversightDashboard = lazy(() => import('./pages/OversightDashboard'));
const ModelManager = lazy(() => import('./pages/ModelManager'));
const AgentManager = lazy(() => import('./pages/AgentManager'));
const EngineDashboard = lazy(() => import('./pages/EngineDashboard'));
const Missions = lazy(() => import('./pages/Missions'));
const Capabilities = lazy(() => import('./pages/Capabilities'));

function RouteLoading() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
      {/* Skeleton bars simulating page layout */}
      <div className="w-full max-w-2xl space-y-3">
        <div className="h-6 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="h-4 w-full bg-zinc-800/60 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-zinc-800/40 rounded animate-pulse" />
        <div className="h-32 w-full bg-zinc-800/30 rounded-lg animate-pulse mt-4" />
        <div className="flex gap-3 mt-4">
          <div className="h-10 w-28 bg-zinc-800/50 rounded animate-pulse" />
          <div className="h-10 w-28 bg-zinc-800/50 rounded animate-pulse" />
        </div>
      </div>
      <span className="text-zinc-600 animate-pulse font-mono text-xs uppercase tracking-widest mt-4">
        Loading Module...
      </span>
    </div>
  );
}

function App() {
  const syncDefaults = useProviderStore(state => state.syncDefaults);

  useEffect(() => {
    syncDefaults();

    // Apply styling engine preferences on load
    const settings = getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute('data-density', settings.density);
  }, [syncDefaults]);

  // Handle detached chat window via hash
  if (typeof window !== 'undefined' && window.location.hash === '#sovereign-chat') {
    const SovereignChat = lazy(() => import('./components/SovereignChat').then(m => ({ default: m.SovereignChat })));
    return (
      <div className="h-screen bg-zinc-950">
        <Suspense fallback={<RouteLoading />}><SovereignChat /></Suspense>
      </div>
    );
  }

  return (
    <Router>
      <ErrorBoundary name="Global OS Hub">
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<OpsDashboard />} />
            <Route path="org-chart" element={<ErrorBoundary name="Org Chart"><Suspense fallback={<RouteLoading />}><OrgChart /></Suspense></ErrorBoundary>} />
            <Route path="standups" element={<ErrorBoundary name="Standups"><Suspense fallback={<RouteLoading />}><Standups /></Suspense></ErrorBoundary>} />
            <Route path="workspaces" element={<ErrorBoundary name="Workspaces"><Suspense fallback={<RouteLoading />}><Workspaces /></Suspense></ErrorBoundary>} />
            <Route path="missions" element={<ErrorBoundary name="Missions"><Suspense fallback={<RouteLoading />}><Missions /></Suspense></ErrorBoundary>} />
            <Route path="models" element={<ErrorBoundary name="AI Provider Manager"><Suspense fallback={<RouteLoading />}><ModelManager /></Suspense></ErrorBoundary>} />
            <Route path="agents" element={<ErrorBoundary name="Agent Manager"><Suspense fallback={<RouteLoading />}><AgentManager /></Suspense></ErrorBoundary>} />
            <Route path="engine" element={<ErrorBoundary name="Engine Dashboard"><Suspense fallback={<RouteLoading />}><EngineDashboard /></Suspense></ErrorBoundary>} />
            <Route path="oversight" element={<ErrorBoundary name="Oversight"><Suspense fallback={<RouteLoading />}><OversightDashboard /></Suspense></ErrorBoundary>} />
            <Route path="capabilities" element={<ErrorBoundary name="Skills & Workflows"><Suspense fallback={<RouteLoading />}><Capabilities /></Suspense></ErrorBoundary>} />
            <Route path="docs" element={<ErrorBoundary name="Docs"><Suspense fallback={<RouteLoading />}><Docs /></Suspense></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary name="Settings"><Suspense fallback={<RouteLoading />}><Settings /></Suspense></ErrorBoundary>} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;

