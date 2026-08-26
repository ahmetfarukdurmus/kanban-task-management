import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage       from '@/pages/LoginPage';
import RegisterPage    from '@/pages/RegisterPage';
import BoardsPage      from '@/pages/BoardsPage';
import BoardDetailPage from '@/pages/BoardDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:            1,
      staleTime:        30_000,   // 30 s
      refetchOnWindowFocus: false,
    },
  },
});

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
              background: '#1e1e35',
              color:       '#ffffff',
              border:      '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize:    '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
            error:   { iconTheme: { primary: '#f43f5e', secondary: '#ffffff' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
