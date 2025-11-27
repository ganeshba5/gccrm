import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import Dashboard from './components/Dashboard';
import LeadDashboard from './components/LeadDashboard';
import ContactsPage from './components/ContactsPage';
import TasksPage from './components/TasksPage';
import NotesPage from './components/NotesPage';
import SettingsPage from './components/SettingsPage';
import { CustomerList } from './components/CustomerList';
import { CustomerForm } from './components/CustomerForm';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<Navigate to="/dashboard" replace />} />
          
          {/* Dashboard Routes with Layout */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LeadDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TasksPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <NotesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Legacy Customer Routes */}
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CustomerList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/new"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CustomerForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:id/edit"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CustomerForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
