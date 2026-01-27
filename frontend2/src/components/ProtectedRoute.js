

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// General Protected Route - requires authentication
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
        return <div>Loading...</div>;
    }
    
    return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

// Admin Route - requires admin role (roleId === 2)
export const AdminRoute = ({ children }) => {
    const { isAuthenticated, isAdmin, loading } = useAuth();
    
    if (loading) {
        return <div>Loading...</div>;
    }
    
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    
    if (!isAdmin()) {
        return <Navigate to="/unauthorized" replace />;
    }
    
    return children;
};

// Customer Route - requires customer role (roleId === 1)
export const CustomerRoute = ({ children }) => {
    const { isAuthenticated, isCustomer, loading } = useAuth();
    
    if (loading) {
        return <div>Loading...</div>;
    }
    
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    
    if (!isCustomer()) {
        return <Navigate to="/unauthorized" replace />;
    }
    
    return children;
};

// Public Route - redirects to home if already authenticated
export const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
        return <div>Loading...</div>;
    }
    
    return isAuthenticated() ? <Navigate to="/" replace /> : children;
};

// Auth Route - requires authentication (alias for ProtectedRoute)
export const AuthRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
        return <div>Loading...</div>;
    }
    
    return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;

