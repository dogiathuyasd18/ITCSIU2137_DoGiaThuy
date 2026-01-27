import axios from 'axios';

// Create axios instance with base configuration
const authAPI = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8080',
    timeout: 10000,
});

// Request interceptor to add auth token
authAPI.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token expiration
authAPI.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth service functions
export const authService = {
    // Login
    login: async (email, password) => {
        try {
            const response = await authAPI.post('/api/login', { email, password });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Register
    register: async (userData) => {
        try {
            const response = await authAPI.post('/api/register', userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get current user profile
    getProfile: async () => {
        try {
            const response = await authAPI.get('/api/profile');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Update user profile
    updateProfile: async (userData) => {
        try {
            const response = await authAPI.put('/api/profile', userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Change password
    changePassword: async (passwordData) => {
        try {
            const response = await authAPI.put('/api/change-password', passwordData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Logout
    logout: async () => {
        try {
            await authAPI.post('/api/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Always clear local storage
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
        }
    },

    // Refresh token
    refreshToken: async () => {
        try {
            const response = await authAPI.post('/api/refresh-token');
            const { access_token } = response.data;
            localStorage.setItem('access_token', access_token);
            return access_token;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Check if token is valid
    validateToken: async () => {
        try {
            const response = await authAPI.get('/api/validate-token');
            return response.data.valid;
        } catch (error) {
            return false;
        }
    }
};

// Protected API service for authenticated requests
export const protectedAPI = {
    // Get user's orders
    getOrders: async () => {
        try {
            const response = await authAPI.get('/api/orders');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Create new order
    createOrder: async (orderData) => {
        try {
            const response = await authAPI.post('/api/orders', orderData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get user's cart
    getCart: async () => {
        try {
            const response = await authAPI.get('/api/cart');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Add item to cart
    addToCart: async (itemData) => {
        try {
            const response = await authAPI.post('/api/cart', itemData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Remove item from cart
    removeFromCart: async (itemId) => {
        try {
            const response = await authAPI.delete(`/api/cart/${itemId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

// Admin API service for admin-only requests
export const adminAPI = {
    // Get all users (admin only)
    getAllUsers: async () => {
        try {
            const response = await authAPI.get('/api/admin/users');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get dashboard data (admin only)
    getDashboardData: async () => {
        try {
            const response = await authAPI.get('/api/get-data-chart');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Create new user (admin only)
    createUser: async (userData) => {
        try {
            const response = await authAPI.post('/api/admin/users', userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Update user (admin only)
    updateUser: async (userId, userData) => {
        try {
            const response = await authAPI.put(`/api/admin/users/${userId}`, userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Delete user (admin only)
    deleteUser: async (userId) => {
        try {
            const response = await authAPI.delete(`/api/admin/users/${userId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

export default authAPI;





























