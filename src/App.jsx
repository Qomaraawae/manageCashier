import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Products from './pages/Products';
import Cashier from './pages/Cashier';
import Reports from './pages/Reports';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentPending from './pages/PaymentPending';
import PaymentCancel from './pages/PaymentCancel';

// Components
import LoadingScreen from './components/ui/LoadingScreen';

function App() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        {/* Auth Routes - Tanpa Layout */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

        {/* Payment Routes - Tanpa Layout (Akses publik) */}
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-pending" element={<PaymentPending />} />
        <Route path="/payment-cancel" element={<PaymentCancel />} />

        {/* App Routes - Dengan DashboardLayout & Auth */}
        <Route element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cashier" element={<Cashier />} />
          <Route path="/products" element={<Products />} />
          <Route path="/reports" element={<Reports />} />
        </Route>

        {/* 404 - Not Found */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

function RootApp() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default RootApp;