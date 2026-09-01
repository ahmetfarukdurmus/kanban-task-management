import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '@/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage       from '@/pages/LoginPage';
import RegisterPage    from '@/pages/RegisterPage';
import BoardsPage      from '@/pages/BoardsPage';
import BoardDetailPage from '@/pages/BoardDetailPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route path="/boards" element={
              <ProtectedRoute><BoardsPage /></ProtectedRoute>
            } />
            <Route path="/boards/:id" element={
              <ProtectedRoute><BoardDetailPage /></ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/boards" replace />} />
          </Routes>
        </BrowserRouter>

        {/* Global toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color:       '#1e293b',
              border:      '1px solid #e2e8f0',
              boxShadow:   '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              borderRadius: '12px',
              fontSize:    '14px',
              fontWeight:  '500',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
