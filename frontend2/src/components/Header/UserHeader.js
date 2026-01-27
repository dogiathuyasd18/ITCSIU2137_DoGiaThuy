import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FaBars, 
  FaTimes, 
  FaSearch, 
  FaGlobe, 
  FaUser, 
  FaCog, 
  FaSignOutAlt
} from 'react-icons/fa';
import { searchProducts } from '../../services/bookingService';
import './Header.scss';

const UserHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleProfileMenu = () => {
    setIsProfileMenuOpen(!isProfileMenuOpen);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setShowSuggestions(false);
    navigate(`/tours?search=${encodeURIComponent(q)}`);
  };

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        const res = await searchProducts(q, 8);
        setSuggestions(res?.products || []);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [searchQuery]);

  return (
    <header className="header user-header">
      <div className="header-container">
        {/* Logo */}
        <div className="logo">
          <Link to="/">
            <FaGlobe className="logo-icon" />
            <span className="logo-text">TourismHub</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="nav-desktop">
          <ul className="nav-list">
            <li className={`nav-item ${isActive('/') ? 'active' : ''}`}>
              <Link to="/">Home</Link>
            </li>
            <li className={`nav-item ${isActive('/products') ? 'active' : ''}`}>
              <Link to="/survey">Survey</Link>
            </li>
            <li className={`nav-item ${isActive('/bookings') ? 'active' : ''}`}>
              <Link to="/bookings">My Bookings</Link>
            </li>
            <li className={`nav-item ${isActive('/booking/new') ? 'active' : ''}`}>
              <Link to="/booking/new">Book Tour</Link>
            </li>
          </ul>
        </nav>

        {/* Search Bar */}
        <div className="search-container">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="search-input"
            />
            <button type="submit" className="search-button">
              <FaSearch />
            </button>

            {showSuggestions && searchQuery.trim().length > 0 && (
              <div className="search-suggestions">
                {suggestionsLoading ? (
                  <div className="search-suggestions__empty">Searching...</div>
                ) : suggestions.length === 0 ? (
                  <div className="search-suggestions__empty">No matches</div>
                ) : (
                  suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="search-suggestion"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSearchQuery(s.name);
                        setShowSuggestions(false);
                        navigate(`/tours?search=${encodeURIComponent(s.name)}`);
                      }}
                    >
                      <div className="suggestion-label">{s.name}</div>
                      <div className="suggestion-sub">Tour</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </form>
        </div>

        {/* User Actions */}
        <div className="user-actions">
          {/* Profile Menu */}
          <div className="profile-menu-container">
            <button className="profile-btn" onClick={toggleProfileMenu}>
              <div className="user-avatar">
                {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <span className="user-name">{user?.firstName || 'User'}</span>
            </button>

            {isProfileMenuOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="profile-info">
                    <div className="profile-avatar">
                      {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </div>
                    <div className="profile-details">
                      <h4>{user?.firstName} {user?.lastName}</h4>
                      <p>{user?.email}</p>
                    </div>
                  </div>
                </div>
                
                <ul className="profile-menu">
                  <li>
                    <Link to="/profile" onClick={toggleProfileMenu}>
                      <FaUser /> My Profile
                    </Link>
                  </li>
                  <li>
                    <Link to="/bookings" onClick={toggleProfileMenu}>
                      My Bookings
                    </Link>
                  </li>
                  <li>
                    <Link to="/booking/new" onClick={toggleProfileMenu}>
                      Book New Tour
                    </Link>
                  </li>
                  <li>
                    <Link to="/settings" onClick={toggleProfileMenu}>
                      <FaCog /> Settings
                    </Link>
                  </li>
                  <li className="divider"></li>
                  <li>
                    <button onClick={handleLogout} className="logout-btn">
                      <FaSignOutAlt /> Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMenu}>
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <nav className={`nav-mobile ${isMenuOpen ? 'open' : ''}`}>
        <ul className="mobile-nav-list">
          <li className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
            <Link to="/" onClick={toggleMenu}>Home</Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/products') ? 'active' : ''}`}>
            <Link to="/products" onClick={toggleMenu}>Tours</Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/bookings') ? 'active' : ''}`}>
            <Link to="/bookings" onClick={toggleMenu}>My Bookings</Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/booking/new') ? 'active' : ''}`}>
            <Link to="/booking/new" onClick={toggleMenu}>Book Tour</Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/favorites') ? 'active' : ''}`}>
            <Link to="/favorites" onClick={toggleMenu}>Favorites</Link>
          </li>
          <li className="mobile-nav-item">
            <div className="mobile-search">
              <input
                type="text"
                placeholder="Search destinations..."
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
            <Link to="/profile" className="btn btn-outline full-width" onClick={toggleMenu}>
              My Profile
            </Link>
          </li>
          <li className="mobile-nav-item">
            <button onClick={handleLogout} className="btn btn-primary full-width">
              Sign Out
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default UserHeader;
