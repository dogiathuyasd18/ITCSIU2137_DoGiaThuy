import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FaBars, 
  FaTimes, 
  FaGlobe, 
  FaSignOutAlt,
  FaChartBar,
  FaUsers,
  FaBox,
  FaCrown
} from 'react-icons/fa';
import './Header.scss';

const AdminHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <header className="header admin-header">
      <div className="header-container">
        {/* Logo */}
        <div className="logo">
          <Link to="/admin">
            <FaGlobe className="logo-icon" />
            <span className="logo-text">TourismHub Admin</span>
            <span className="admin-badge">
              <FaCrown />
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="nav-desktop">
          <ul className="nav-list">
            <li className={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
              <Link to="/admin">
                <FaChartBar /> Dashboard
              </Link>
            </li>
            <li className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`}>
              <Link to="/admin/users">
                <FaUsers /> Users
              </Link>
            </li>
            <li className={`nav-item ${isActive('/admin/products') ? 'active' : ''}`}>
              <Link to="/admin/products">
                <FaBox /> Products
              </Link>
            </li>
            <li className={`nav-item ${isActive('/admin/analytics') ? 'active' : ''}`}>
              <Link to="/admin/analytics">
                <FaChartBar /> Analytics
              </Link>
            </li>
            <li className={`nav-item ${isActive('/admin/update') ? 'active' : ''}`}>
              <Link to="/admin/update">
                <FaGlobe /> Update
              </Link>
            </li>
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="admin-actions">
          <button onClick={handleLogout} className="logout-button">
            <FaSignOutAlt /> Logout
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMenu}>
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {/* <nav className={`nav-mobile ${isMenuOpen ? 'open' : ''}`}>
        <ul className="mobile-nav-list">
          <li className={`mobile-nav-item ${isActive('/admin') ? 'active' : ''}`}>
            <Link to="/admin" onClick={toggleMenu}>
              <FaChartBar /> Dashboard
            </Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/admin/users') ? 'active' : ''}`}>
            <Link to="/admin/users" onClick={toggleMenu}>
              <FaUsers /> Users
            </Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/admin/products') ? 'active' : ''}`}>
            <Link to="/admin/products" onClick={toggleMenu}>
              <FaBox /> Products
            </Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/admin/orders') ? 'active' : ''}`}>
            <Link to="/admin/orders" onClick={toggleMenu}>
              <FaClipboardList /> Orders
            </Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/admin/analytics') ? 'active' : ''}`}>
            <Link to="/admin/analytics" onClick={toggleMenu}>
              <FaChartBar /> Analytics
            </Link>
          </li>
          <li className="mobile-nav-item">
            <div className="mobile-search">
              <input
                type="text"
                placeholder="Search users, products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mobile-search-input"
              />
              <button onClick={handleSearch} className="mobile-search-btn">
                <FaSearch />
              </button>
            </div>
          </li>
          <li className="mobile-nav-item">
            <Link to="/admin/profile" className="btn btn-outline full-width" onClick={toggleMenu}>
              Admin Profile
            </Link>
          </li>
          <li className="mobile-nav-item">
            <Link to="/" className="btn btn-secondary full-width" onClick={toggleMenu}>
              View Public Site
            </Link>
          </li>
          <li className="mobile-nav-item">
            <button onClick={handleLogout} className="btn btn-primary full-width">
              Sign Out
            </button>
          </li>
        </ul>
      </nav> */}
    </header>
  );
};

export default AdminHeader;
