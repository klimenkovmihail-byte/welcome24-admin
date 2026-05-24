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
import Login from './pages/Login';
import { isAuthenticated, fetchMe } from './auth/auth';

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

export default function App() {
  useEffect(() => {
    // Валидируем токен на старте (в фоне). Если 401 — fetchMe сам стирает user.
    fetchMe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/deals" element={<Deals />} />
                <Route path="/shares" element={<Shares />} />
                <Route path="/academy" element={<Academy />} />
                <Route path="/news" element={<News />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
