import { Navigate, Outlet } from 'react-router-dom';

type ProtectedRouteProps = {
  isAuthenticated: boolean;
  booting: boolean;
};

export const ProtectedRoute = ({ isAuthenticated, booting }: ProtectedRouteProps) => {
  if (booting) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <Outlet />;
};
