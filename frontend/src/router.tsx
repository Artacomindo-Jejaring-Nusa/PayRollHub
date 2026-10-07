import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './features/auth/pages/LoginPage';
import { DashboardOverviewPage } from './features/dashboard/pages/DashboardOverviewPage';
import { PayrollListPage } from './features/payroll/pages/PayrollListPage';
import { PayrollFormPage } from './features/payroll/pages/PayrollFormPage';
import { PayrollDetailPage } from './features/payroll/pages/PayrollDetailPage';
import { PayrollImportPage } from './features/payroll/pages/PayrollImportPage';
import { UserListPage } from './features/users/pages/UserListPage';

// Guard: Must be authenticated
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Guard: Must be Admin
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuthStore();
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Guard: Public only (e.g. login page)
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes Wrapped in DashboardLayout */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard Overview */}
        <Route path="/" element={<DashboardOverviewPage />} />
        <Route path="/dashboard" element={<DashboardOverviewPage />} />

        {/* Data Penggajian */}
        <Route path="/payrolls" element={<PayrollListPage />} />
        <Route path="/payrolls/:id" element={<PayrollDetailPage />} />

        {/* Admin Restricted Routes */}
        <Route
          path="/payrolls/create"
          element={
            <AdminRoute>
              <PayrollFormPage />
            </AdminRoute>
          }
        />
        <Route
          path="/payrolls/:id/edit"
          element={
            <AdminRoute>
              <PayrollFormPage />
            </AdminRoute>
          }
        />
        <Route
          path="/payrolls/import"
          element={
            <AdminRoute>
              <PayrollImportPage />
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UserListPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
