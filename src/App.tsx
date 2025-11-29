import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import Dashboard from './components/Dashboard';
import OpportunityDashboard from './components/OpportunityDashboard';
// ContactsPage, TasksPage, NotesPage are used via EntityNotesPage and EntityTasksPage
import SettingsPage from './components/SettingsPage';
import { AccountList } from './components/AccountList';
import { AccountForm } from './components/AccountForm';
import { ContactList } from './components/ContactList';
import { ContactForm } from './components/ContactForm';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { NoteList } from './components/NoteList';
import { NoteForm } from './components/NoteForm';
import { UserList } from './components/UserList';
import { UserForm } from './components/UserForm';
import { CustomerList } from './components/CustomerList';
import { CustomerForm } from './components/CustomerForm';
import { OpportunityNotesPage, AccountNotesPage, ContactNotesPage } from './components/EntityNotesPage';
import { OpportunityTasksPage, AccountTasksPage, ContactTasksPage } from './components/EntityTasksPage';
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
          {/* Opportunity routes - specific routes must come before general ones */}
          <Route
            path="/opportunities/:id/notes"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OpportunityNotesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/opportunities/:id/tasks"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OpportunityTasksPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/opportunities"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OpportunityDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          {/* Legacy route for backward compatibility */}
          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OpportunityDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/new"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/:id/edit"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/:id/notes"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactNotesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/:id/tasks"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactTasksPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TaskList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/new"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TaskForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:id/edit"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TaskForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <NoteList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes/new"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <NoteForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes/:id/edit"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <NoteForm />
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
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UserList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/new"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UserForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:id/edit"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UserForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Accounts Routes */}
          <Route
            path="/accounts"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AccountList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts/new"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AccountForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts/:id/edit"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AccountForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts/:id/view"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AccountForm />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts/:id/notes"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AccountNotesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts/:id/tasks"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AccountTasksPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Legacy Customer Routes (for backward compatibility) */}
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
