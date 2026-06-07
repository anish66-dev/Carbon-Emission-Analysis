import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './Landing';
import IdentityAccessGateway from './Login';
import ExecutiveDashboard from './Dashboard';

export default function App() {
  // Track active security session parameters globally
  const [userSession, setUserSession] = useState({
    role: localStorage.getItem('user_role') || null,
    tenantId: localStorage.getItem('tenant_id') || null,
    isAuthenticated: !!localStorage.getItem('session_token')
  });

  const handleLoginSuccess = (sessionData) => {
    setUserSession({
      role: sessionData.role,
      tenantId: sessionData.tenant_id,
      isAuthenticated: true
    });
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserSession({ role: null, tenantId: null, isAuthenticated: false });
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route: The Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Public Route: The Identity Access Gateway */}
        <Route
          path="/login"
          element={
            userSession.isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <IdentityAccessGateway onLoginSuccess={handleLoginSuccess} />
            )
          }
        />

        {/* Protected Route: The Executive Dashboard Dashboard Layout */}
        <Route
          path="/dashboard"
          element={
            userSession.isAuthenticated ? (
              <ExecutiveDashboard sessionCtx={userSession} onLogout={handleLogout} /> // <-- Ensure onLogout={handleLogout} is exactly here!
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Wildcard Fallback: If a user types a dead link, bounce them home */}
        <Route path="*" replace element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}