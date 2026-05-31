import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminTerritories from './pages/admin/Territories';
import AdminAssignments from './pages/admin/Assignments';
import AdminUsers from './pages/admin/Users';
import AdminReports from './pages/admin/Reports';
import AdminHistory from './pages/admin/History';
import GeneralMaps from './pages/GeneralMaps';
import MyUser from './pages/MyUser';
import DirigenteDashboard from './pages/dirigente/Dashboard';
import DirigentHistory from './pages/dirigente/History';
import AssignmentDetail from './pages/AssignmentDetail';
import Layout from './components/Layout';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="territories" element={<AdminTerritories />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="history" element={<AdminHistory />} />
      </Route>

      {/* Dirigente Routes */}
      <Route
        path="/dirigente"
        element={
          <ProtectedRoute allowedRoles={['dirigente']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DirigenteDashboard />} />
        <Route path="my-user" element={<MyUser />} />
        <Route path="history" element={<DirigentHistory />} />
      </Route>

      {/* Shared Routes */}
      <Route
        path="/general-maps"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<GeneralMaps />} />
      </Route>

      <Route
        path="/assignment/:id"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AssignmentDetail />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === 'admin' ? '/admin' : '/dirigente'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

