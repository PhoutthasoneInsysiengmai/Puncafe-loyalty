import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CustomerDashboard from "./pages/CustomerDashboard";
import StaffScanner from "./pages/StaffScanner";
import AdminDashboard from "./pages/AdminDashboard";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div style={styles.loading}>กำลังโหลด...</div>;
  if (!user) return <Navigate to="/login" />;

  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    // Redirect ตาม role แทนที่จะไป login
    if (profile?.role === "admin") return <Navigate to="/admin" />;
    if (profile?.role === "staff") return <Navigate to="/scanner" />;
    if (profile?.role === "customer") return <Navigate to="/dashboard" />;
    return <Navigate to="/login" />;
  }

  return children;
}

function AppRoutes() {
  const { profile, loading } = useAuth();

  if (loading) return <div style={styles.loading}>กำลังโหลด...</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["customer"]}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/scanner"
        element={
          <ProtectedRoute allowedRoles={["staff", "admin"]}>
            <StaffScanner />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* ← แก้ตรงนี้ รอ profile โหลดเสร็จก่อน */}
      <Route
        path="/"
        element={
          !profile ? (
            <Navigate to="/login" />
          ) : profile.role === "customer" ? (
            <Navigate to="/dashboard" />
          ) : profile.role === "staff" ? (
            <Navigate to="/scanner" />
          ) : profile.role === "admin" ? (
            <Navigate to="/admin" />
          ) : (
            <Navigate to="/login" />
          )
        }
      />

      {/* ← เพิ่ม catch-all redirect */}
      <Route
        path="*"
        element={
          !profile ? (
            <Navigate to="/login" />
          ) : profile.role === "customer" ? (
            <Navigate to="/dashboard" />
          ) : profile.role === "staff" ? (
            <Navigate to="/scanner" />
          ) : profile.role === "admin" ? (
            <Navigate to="/admin" />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

const styles = {
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    color: "#888",
  },
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
