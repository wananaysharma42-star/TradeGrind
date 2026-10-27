import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * ProtectedRoute - Guard checking authentication and user role.
 */
export function ProtectedRoute({ children, allowedRole = null }) {
  const { isAuthenticated, user, isLoading } = useSelector((state) => state.auth);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-base text-mauve text-xs">
        Authenticating simulation session...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    // Redirect to user's authorized home if role mismatches
    return <Navigate to={user.role === 'COMPANY' ? '/company' : '/dashboard'} replace />;
  }

  return children;
}

export default ProtectedRoute;
