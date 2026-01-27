import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaSearch, FaGlobe } from 'react-icons/fa';
import { searchProducts } from '../../services/bookingService';
import './Header.scss';

const VisitorHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setShowSuggestions(false);
    navigate(`/tours?search=${encodeURIComponent(q)}`);
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
    }, 200); // debounce

    return () => clearTimeout(handle);
  }, [searchQuery]);

  return (
    <header className="header visitor-header">
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
            <li className={`nav-item ${isActive('/tours') ? 'active' : ''}`}>
              <Link to="/tours">Tours</Link>
            </li>
            <li className={`nav-item ${isActive('/about') ? 'active' : ''}`}>
              <Link to="/about">About</Link>
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

        {/* Auth Buttons */}
        <div className="auth-buttons">
          <Link to="/login" className="btn btn-outline">
            Sign In
          </Link>
          <Link to="/register" className="btn btn-primary">
            Sign Up
          </Link>
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
          <li className={`mobile-nav-item ${isActive('/tours') ? 'active' : ''}`}>
            <Link to="/tours" onClick={toggleMenu}>Tours</Link>
          </li>
          <li className={`mobile-nav-item ${isActive('/about') ? 'active' : ''}`}>
            <Link to="/about" onClick={toggleMenu}>About</Link>
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
            <Link to="/login" className="btn btn-outline full-width" onClick={toggleMenu}>
              Sign In
            </Link>
          </li>
          <li className="mobile-nav-item">
            <Link to="/register" className="btn btn-primary full-width" onClick={toggleMenu}>
              Sign Up
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default VisitorHeader;




































