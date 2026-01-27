import React, { createContext, useContext, useState, useEffect } from 'react';
import userService from '../services/userService';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize auth state from localStorage
    useEffect(() => {
        const initializeAuth = () => {
            try {
                const storedUser = localStorage.getItem('user');
                const storedToken = localStorage.getItem('access_token');
                
                if (storedUser && storedToken) {
                    setUser(JSON.parse(storedUser));
                    setToken(storedToken);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                logout();
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Login function
    const login = async (email, password) => {
        try {
            console.log('AuthContext: Attempting login with email:', email);
            const response = await userService.handleLoginAPI(email, password);
            console.log('AuthContext: Login response:', response);
            
            if (response && response.errCode === 0) {
                const userData = response.user;
                const accessToken = response.access_token;
                
                console.log('AuthContext: User data received:', userData);
                console.log('AuthContext: User roleId:', userData.roleId);
                
                // Store in localStorage
                localStorage.setItem('user', JSON.stringify(userData));
                localStorage.setItem('access_token', accessToken);
                
                // Update state
                setUser(userData);
                setToken(accessToken);
                
                console.log('AuthContext: State updated, user:', userData);
                console.log('AuthContext: isAdmin check:', userData.roleId === 2);
                console.log('AuthContext: isCustomer check:', userData.roleId === 1);
                
                return { success: true, user: userData };
            } else {
                console.log('AuthContext: Login failed:', response);
                return { success: false, message: response?.message || 'Login failed' };
            }
        } catch (error) {
            console.error('AuthContext: Login error:', error);
            return { success: false, message: 'Login failed' };
        }
    };

    // Logout function
    const logout = () => {
        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        
        // Clear state
        setUser(null);
        setToken(null);
    };

    // Check if user has specific role
    const hasRole = (roleId) => {
        return user && user.roleId === roleId;
    };

    // Check if user is admin (2)
    const isAdmin = () => {
        const result = hasRole(2);
        console.log('AuthContext: isAdmin() called, result:', result, 'user roleId:', user?.roleId);
        return result;
    };

    // Check if user is customer (1)
    const isCustomer = () => {
        const result = hasRole(1);
        console.log('AuthContext: isCustomer() called, result:', result, 'user roleId:', user?.roleId);
        return result;
    };

    // Check if user is authenticated
    const isAuthenticated = () => {
        const result = !!user && !!token;
        console.log('AuthContext: isAuthenticated() called, result:', result, 'user:', user, 'token:', token);
        return result;
    };

    // Update user data
    const updateUser = (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        hasRole,
        isAdmin,
        isCustomer,
        isAuthenticated,
        updateUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
