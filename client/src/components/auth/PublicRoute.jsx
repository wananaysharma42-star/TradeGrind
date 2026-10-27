import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * PublicRoute - Route guard for public pages (LandingPage, Login, Register).
 * If the user has a valid cookie/session, automatically redirects them
 * to their respective home page (/dashboard for CUSTOMER, /company for COMPANY).
 */
export function PublicRoute({ children }) {
  const { isAuthenticated, user, isLoading, isRehydrating } = useSelector((state) => state.auth);

  if (isRehydrating || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-accent text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const destination = user.role === 'COMPANY' ? '/company' : '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return children;
}

export default PublicRoute;
