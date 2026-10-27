import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * ProtectedRoute - Guard checking authentication and user role.
 */
export function ProtectedRoute({ children, allowedRole = null }) {
  const { isAuthenticated, user, isLoading, isRehydrating } = useSelector((state) => state.auth);

  if (isRehydrating || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-accent text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Authenticating simulation session...</span>
        </div>
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
