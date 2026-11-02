import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { CAN_VIEW_ANALYTICS, CAN_MANAGE_USERS } from '@/lib/permissions';
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

const AuditLogPage = lazy(() => import('@/pages/AuditLogPage').then((module) => ({ default: module.AuditLogPage })));
const IncidentsPage = lazy(() => import('@/pages/IncidentsPage').then((module) => ({ default: module.IncidentsPage })));
const TrafficMapPage = lazy(() => import('@/pages/TrafficMapPage').then((module) => ({ default: module.TrafficMapPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const IntersectionsPage = lazy(() => import('@/pages/IntersectionsPage').then((module) => ({ default: module.IntersectionsPage })));
const IntersectionDetailPage = lazy(() =>
  import('@/pages/IntersectionDetailPage').then((module) => ({ default: module.IntersectionDetailPage })),
);
const LiveSimulationPage = lazy(() => import('@/pages/LiveSimulationPage').then((module) => ({ default: module.LiveSimulationPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const UsersPage = lazy(() => import('@/pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const SystemSettingsPage = lazy(() =>
  import('@/pages/SystemSettingsPage').then((module) => ({ default: module.SystemSettingsPage })),
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="intersections" element={<IntersectionsPage />} />
            <Route path="intersections/:intersectionId" element={<IntersectionDetailPage />} />
            <Route path="simulation" element={<LiveSimulationPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="map" element={<TrafficMapPage />} />
            <Route
              path="analytics"
              element={
                <RequireAuth roles={CAN_VIEW_ANALYTICS}>
                  <AnalyticsPage />
                </RequireAuth>
              }
            />
            <Route
              path="users"
              element={
                <RequireAuth roles={CAN_MANAGE_USERS}>
                  <UsersPage />
                </RequireAuth>
              }
            />
            <Route
              path="audit"
              element={
                <RequireAuth roles={CAN_MANAGE_USERS}>
                  <AuditLogPage />
                </RequireAuth>
              }
            />
            <Route
              path="settings"
              element={
                <RequireAuth roles={CAN_MANAGE_USERS}>
                  <SystemSettingsPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
