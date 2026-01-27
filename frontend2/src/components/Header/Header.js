import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import VisitorHeader from './VisitorHeader';
import UserHeader from './UserHeader';
import AdminHeader from './AdminHeader';

const Header = () => {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();

  console.log('Header: Current state - user:', user, 'loading:', loading);
  console.log('Header: isAuthenticated():', isAuthenticated());
  console.log('Header: isAdmin():', isAdmin());

  // Show loading state while checking authentication
  if (loading) {
    console.log('Header: Showing loading header');
    return (
      <header className="header loading-header">
        <div className="header-container">
          <div className="logo">
            <span className="logo-text">TourismHub</span>
          </div>
          <div className="loading-spinner"></div>
        </div>
      </header>
    );
  }

  // Render appropriate header based on user role
  if (isAuthenticated()) {
    if (isAdmin()) {
      console.log('Header: Rendering AdminHeader');
      return <AdminHeader />;
    } else {
      console.log('Header: Rendering UserHeader');
      return <UserHeader />;
    }
  }

  // Default to visitor header for non-authenticated users
  console.log('Header: Rendering VisitorHeader');
  return <VisitorHeader />;
};

export default Header;
