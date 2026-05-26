import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Deals from './pages/Deals';
import Shares from './pages/Shares';
import Academy from './pages/Academy';
import News from './pages/News';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import BackofficeTeam from './pages/BackofficeTeam';
import Support from './pages/Support';
import SubscriptionClaims from './pages/SubscriptionClaims';
import Subscriptions from './pages/Subscriptions';
import Docs from './pages/Docs';
import Login from './pages/Login';
import { isAuthenticated, fetchMe, getCurrentUser } from './auth/auth';
import { canAccess, firstAccessiblePath, type Role } from './auth/roles';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ssoEmail')) {
      return <Navigate to={`/login${location.search}`} replace />;
    }
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Защищает конкретный путь по роли. Если у пользователя нет доступа —
// редиректит на первую разрешённую страницу.
function RoleRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const user = getCurrentUser();
  const role = (user?.role || 'agent') as Role;
  if (!canAccess(role, path)) return <Navigate to={firstAccessiblePath(role)} replace />;
  return <>{children}</>;
}

// Корневой редирект — на первую доступную для роли страницу.
function HomeRedirect() {
  const user = getCurrentUser();
  const role = (user?.role || 'agent') as Role;
  return <Navigate to={firstAccessiblePath(role)} replace />;
}

export default function App() {
  useEffect(() => {
    // Валидируем токен на старте (в фоне). Если 401 — fetchMe сам стирает user.
    fetchMe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<RoleRoute path="/dashboard"><Dashboard /></RoleRoute>} />
                <Route path="/agents" element={<RoleRoute path="/agents"><Agents /></RoleRoute>} />
                <Route path="/deals" element={<RoleRoute path="/deals"><Deals /></RoleRoute>} />
                <Route path="/shares" element={<RoleRoute path="/shares"><Shares /></RoleRoute>} />
                <Route path="/academy" element={<RoleRoute path="/academy"><Academy /></RoleRoute>} />
                <Route path="/news" element={<RoleRoute path="/news"><News /></RoleRoute>} />
                <Route path="/analytics" element={<RoleRoute path="/analytics"><Analytics /></RoleRoute>} />
                <Route path="/backoffice" element={<RoleRoute path="/backoffice"><BackofficeTeam /></RoleRoute>} />
                <Route path="/support" element={<RoleRoute path="/support"><Support /></RoleRoute>} />
                <Route path="/subscription-claims" element={<RoleRoute path="/subscription-claims"><SubscriptionClaims /></RoleRoute>} />
                <Route path="/subscriptions" element={<RoleRoute path="/subscriptions"><Subscriptions /></RoleRoute>} />
                <Route path="/docs" element={<RoleRoute path="/docs"><Docs /></RoleRoute>} />
                <Route path="/settings" element={<RoleRoute path="/settings"><Settings /></RoleRoute>} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
