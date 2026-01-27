import authAPI from './authService';
import axios from 'axios';

// Public API instance (no auth interceptor)
const publicAPI = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8080',
    timeout: 10000
});

// Get all products (tours)
export const getProducts = async () => {
    try {
        const response = await authAPI.get('/api/products');
        console.log(response.data)
        return response.data;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
};

// Search products by name for header autocomplete (public)
export const searchProducts = async (q, limit = 8) => {
    try {
        const response = await publicAPI.get('/api/products/search', {
            params: { q, limit }
        });
        return response.data;
    } catch (error) {
        console.error('Error searching products:', error);
        throw error;
    }
};

// Get active promotions
export const getActivePromotions = async () => {
    try {
        const response = await authAPI.get('/api/promotions');
        return response.data;
    } catch (error) {
        console.error('Error fetching promotions:', error);
        throw error;
    }
};

// Create a new booking
export const createBooking = async (bookingData) => {
    try {
        const response = await authAPI.post('/api/bookings', bookingData);
        // console.log("Data is given: ", bookingData);
        return response.data;
    } catch (error) {
        console.error('Error creating booking:', error);
        throw error;
    }
};

// Create a booking as a guest (no login) - requires guest contact info
export const createGuestBooking = async (payload) => {
    try {
        const response = await publicAPI.post('/api/guest/bookings', payload);
        return response.data;
    } catch (error) {
        console.error('Error creating guest booking:', error);
        throw error;
    }
};

// Get user's bookings
export const getUserBookings = async () => {
    try {
        const response = await authAPI.get('/api/bookings');
        return response.data;
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        // If there's an error but we can extract a response, return it
        if (error?.response?.data) {
            return error.response.data;
        }
        // Otherwise return a structured error response
        return {
            errCode: -1,
            message: error?.message || 'Failed to load bookings',
            bookings: [] // Return empty array so UI doesn't break
        };
    }
};

// Get booking by ID
export const getBookingById = async (bookingId) => {
    try {
        const response = await authAPI.get(`/api/bookings/${bookingId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching booking:', error);
        throw error;
    }
};

// Cancel booking
export const cancelBooking = async (bookingId) => {
    try {
        const response = await authAPI.put(`/api/bookings/${bookingId}/cancel`);
        return response.data;
    } catch (error) {
        console.error('Error cancelling booking:', error);
        throw error;
    }
};

// Start MoMo payment for a given amount + bookingId (customer-only route)
export const startPayment = async (amount, bookingId) => {
    try {
        const response = await authAPI.post('/payment1', { amount, bookingId });
        return response.data;
    } catch (error) {
        console.error('Error starting payment:', error);
        throw error;
    }
};

// Log an experiment exposure (A/B test). Backend will ignore if experiment is inactive.
export const logExperimentExposure = async ({ productId = null, event = 'view', basePrice = null } = {}) => {
    try {
        const response = await authAPI.post('/api/experiment/exposure', { productId, event, basePrice });
        return response.data;
    } catch (error) {
        // Non-blocking: ignore errors so the UI flow doesn't break.
        console.warn('Error logging experiment exposure:', error?.response?.data || error.message);
        return null;
    }
};

// Update booking payment status
export const updatePaymentStatus = async (bookingId, paymentStatus, transactionId) => {
    try {
        const response = await authAPI.put(`/api/bookings/${bookingId}/payment-status`, {
            paymentStatus,
            transactionId
        });
        return response.data;
    } catch (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }
};

// Directly confirm booking (bypass payment gateway)
export const confirmBookingDirectly = async (bookingId) => {
    try {
        const response = await authAPI.post(`/api/bookings/${bookingId}/confirm`);
        return response.data;
    } catch (error) {
        console.error('Error confirming booking directly:', error);
        throw error;
    }
};

// Get travel dates by product ID
export const getTravelDatesByProductId = async (productId) => {
    try {
        // This endpoint supports optional auth; use public API so guests don't get redirected on 401
        const response = await publicAPI.get(`/api/travel-dates?productId=${productId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching travel dates:', error);
        throw error;
    }
};










