import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PublicRoute } from "./components/auth/PublicRoute";

// Layout components
import { Layout } from "./components/layout/Layout";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";

// Public pages
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { PropertyListPage } from "./pages/properties/PropertyListPage";
import { PropertyDetailPage } from "./pages/properties/PropertyDetailPage";

// Protected pages
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { PropertyCreatePage } from "./pages/properties/PropertyCreatePage";
import { PropertyEditPage } from "./pages/properties/PropertyEditPage";
import { ApplicationPage } from "./pages/applications/ApplicationPage";
import { ApplicationsListPage } from "./pages/applications/ApplicationsListPage";
import { PaymentsPage } from "./pages/payments/PaymentsPage";

// Loading component
import { LoadingSpinner } from "./components/ui/LoadingSpinner";

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/properties" element={<PropertyListPage />} />
      <Route path="/properties/:id" element={<PropertyDetailPage />} />

      {/* Auth routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPasswordPage />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/create"
        element={
          <ProtectedRoute requiredUserType="landlord">
            <Layout>
              <PropertyCreatePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id/edit"
        element={
          <ProtectedRoute requiredUserType="landlord">
            <Layout>
              <PropertyEditPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id/apply"
        element={
          <ProtectedRoute requiredUserType="renter">
            <Layout>
              <ApplicationPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/applications"
        element={
          <ProtectedRoute>
            <Layout>
              <ApplicationsListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Layout>
              <PaymentsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AppRoutes />
      </div>
    </AuthProvider>
  );
};

export default App;
