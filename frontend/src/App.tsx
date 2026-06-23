import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/ui/Layout";
import { Spinner } from "./components/ui/Spinner";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ReconstructPage from "./pages/ReconstructPage";
import MergePage from "./pages/MergePage";
import SplitPage from "./pages/SplitPage";
import OrganizePage from "./pages/OrganizePage";
import ReorderPage from "./pages/ReorderPage";
import PageNumbersPage from "./pages/PageNumbersPage";
import CropPage from "./pages/CropPage";
import DashboardPage from "./pages/DashboardPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
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
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reconstruct"
        element={
          <ProtectedRoute>
            <ReconstructPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/merge"
        element={
          <ProtectedRoute>
            <MergePage />
          </ProtectedRoute>
        }
      />
      <Route path="/combine" element={<Navigate to="/merge" replace />} />
      <Route
        path="/split"
        element={
          <ProtectedRoute>
            <SplitPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organize"
        element={
          <ProtectedRoute>
            <OrganizePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reorder"
        element={
          <ProtectedRoute>
            <ReorderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/page-numbers"
        element={
          <ProtectedRoute>
            <PageNumbersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/crop"
        element={
          <ProtectedRoute>
            <CropPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
