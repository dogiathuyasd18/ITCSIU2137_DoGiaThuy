import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
// import '../../assets/styles/Unauthorized.scss';

const Unauthorized = () => {
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="unauthorized-container">
            <div className="unauthorized-content">
                <div className="error-icon">
                    <i className="fas fa-exclamation-triangle"></i>
                </div>
                
                <h1>Access Denied</h1>
                
                <p className="error-message">
                    Sorry, you don't have permission to access this page.
                </p>
                
                <div className="user-info">
                    {user ? (
                        <p>
                            You are logged in as: <strong>{user.firstName} {user.lastName}</strong>
                            <br />
                            Role: <strong>{user.roleId === 2 ? 'Administrator' : 'Customer'}</strong>
                        </p>
                    ) : (
                        <p>You are not logged in.</p>
                    )}
                </div>
                
                <div className="action-buttons">
                    <Link to="/" className="btn btn-primary">
                        <i className="fas fa-home"></i> Go to Home
                    </Link>
                    
                    {user ? (
                        <>
                            <Link to="/profile" className="btn btn-secondary">
                                <i className="fas fa-user"></i> My Profile
                            </Link>
                            <button onClick={handleLogout} className="btn btn-outline">
                                <i className="fas fa-sign-out-alt"></i> Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn btn-secondary">
                            <i className="fas fa-sign-in-alt"></i> Login
                        </Link>
                    )}
                </div>
                
                <div className="help-section">
                    <h3>Need Help?</h3>
                    <p>
                        If you believe you should have access to this page, please contact support.
                    </p>
                    <a href="mailto:support@tourism.com" className="support-link">
                        <i className="fas fa-envelope"></i> Contact Support
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;
