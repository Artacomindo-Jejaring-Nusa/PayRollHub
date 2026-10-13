import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { DashboardLayout } from './layouts/DashboardLayout';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { LoginPage } from './features/auth/pages/LoginPage';
import { DashboardOverviewPage } from './features/dashboard/pages/DashboardOverviewPage';
import { PayrollListPage } from './features/payroll/pages/PayrollListPage';
import { PayrollFormPage } from './features/payroll/pages/PayrollFormPage';
import { PayrollDetailPage } from './features/payroll/pages/PayrollDetailPage';
import { PayrollImportPage } from './features/payroll/pages/PayrollImportPage';
import { UserListPage } from './features/users/pages/UserListPage';
import { EmployeeDashboardPage } from './features/employee/pages/EmployeeDashboardPage';
import { EmployeePayrollsPage } from './features/employee/pages/EmployeePayrollsPage';
import { EmployeeReportsPage } from './features/employee/pages/EmployeeReportsPage';
import { EmployeeAnnouncementsPage } from './features/employee/pages/EmployeeAnnouncementsPage';
import { EmployeeProfilePage } from './features/employee/pages/EmployeeProfilePage';
import { AnnouncementManagePage } from './features/announcements/pages/AnnouncementManagePage';
import { AdminWorkReportsPage } from './features/reports/pages/AdminWorkReportsPage';
import { EmployeeAttendancePage } from './features/attendance/pages/EmployeeAttendancePage';
import { AdminAttendancePage } from './features/attendance/pages/AdminAttendancePage';
import { ActivityLogsPage } from './features/activityLogs/pages/ActivityLogsPage';
import { EmployeeComplaintsPage } from './features/complaints/pages/EmployeeComplaintsPage';
import { AdminComplaintsPage } from './features/complaints/pages/AdminComplaintsPage';

// Guard: Must be authenticated
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Guard: Staff / HR / Admin only (non-karyawan)
const StaffRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuthStore();
  if (user?.role === 'karyawan') {
    return <Navigate to="/employee/dashboard" replace />;
  }
  return children;
};

// Guard: Employee only
const EmployeeRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuthStore();
  if (user?.role !== 'karyawan') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Guard: Must be Admin or Super Admin
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuthStore();
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Guard: Must be Super Admin
const SuperAdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuthStore();
  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Guard: Public only (e.g. login page)
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) {
    if (user?.role === 'karyawan') {
      return <Navigate to="/employee/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export const AppRouter: React.FC = () => {
  const { user } = useAuthStore();

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

      {/* ======================================================== */}
      {/* EMPLOYEE SELF-SERVICE PORTAL ROUTES                      */}
      {/* ======================================================== */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute>
            <EmployeeRoute>
              <EmployeeLayout />
            </EmployeeRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeDashboardPage />} />
        <Route path="dashboard" element={<EmployeeDashboardPage />} />
        <Route path="attendance" element={<EmployeeAttendancePage />} />
        <Route path="payrolls" element={<EmployeePayrollsPage />} />
        <Route path="reports" element={<EmployeeReportsPage />} />
        <Route path="announcements" element={<EmployeeAnnouncementsPage />} />
        <Route path="complaints" element={<EmployeeComplaintsPage />} />
        <Route path="profile" element={<EmployeeProfilePage />} />
      </Route>

      {/* ======================================================== */}
      {/* ADMIN & HR STAFF ROUTES (DashboardLayout)               */}
      {/* ======================================================== */}
      <Route
        element={
          <ProtectedRoute>
            <StaffRoute>
              <DashboardLayout />
            </StaffRoute>
          </ProtectedRoute>
        }
      >
        {/* Dashboard Overview */}
        <Route path="/" element={<DashboardOverviewPage />} />
        <Route path="/dashboard" element={<DashboardOverviewPage />} />

        {/* Manajemen Absensi Geofencing Radius */}
        <Route path="/attendances" element={<AdminAttendancePage />} />
        {/* Presensi Mandiri Admin di Kantor Pusat (Point 10) */}
        <Route path="/my-attendance" element={<EmployeeAttendancePage />} />

        {/* Data Penggajian */}
        <Route path="/payrolls" element={<PayrollListPage />} />
        <Route path="/payrolls/:id" element={<PayrollDetailPage />} />

        {/* Laporan Kerja Review & Papan Pengumuman */}
        <Route
          path="/work-reports"
          element={
            <AdminRoute>
              <AdminWorkReportsPage />
            </AdminRoute>
          }
        />
        <Route path="/announcements" element={<AnnouncementManagePage />} />
        {/* Keluhan Karyawan (Point 11) */}
        <Route path="/complaints" element={<AdminComplaintsPage />} />

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
        <Route
          path="/activity-logs"
          element={
            <AdminRoute>
              <ActivityLogsPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route
        path="*"
        element={
          <Navigate
            to={user?.role === 'karyawan' ? '/employee/dashboard' : '/dashboard'}
            replace
          />
        }
      />
    </Routes>
  );
};
