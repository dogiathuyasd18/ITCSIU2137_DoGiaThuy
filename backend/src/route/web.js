import express from "express";
import homeController from '../controllers/homeController.js';
import userController from '../controllers/userController.js';
import bookingController from '../controllers/bookingController.js';
import adminController from "../controllers/adminController.js";
import adminService from "../services/adminService.js";
import experimentController from "../controllers/experimentController.js";
const delay = require('../middleware/delay.js');
const { isAuthenticated, isAdmin, isCustomer, optionalAuth } = require('../middleware/auth.js');

let router = express.Router();

let initWebRoutes = (app) => {

    router.all("*", delay);

    // Public routes (no authentication required)

    // Authentication routes
    router.post('/api/login', userController.handleLogin);
    router.post('/api/register', userController.handleRegister);

    // Protected routes (authentication required)

    // Booking routes (authentication required)
    router.get('/api/products/search', bookingController.searchProducts);
    router.get('/api/products', bookingController.getProducts);
    router.get('/api/promotions', bookingController.getActivePromotions);
    router.post('/api/bookings', isAuthenticated, bookingController.createBooking);
    // Guest booking (no authentication): collects guest info + creates booking
    router.post('/api/guest/bookings', bookingController.createGuestBooking);
    router.post('/api/survey', isAuthenticated, userController.handleCreateSurvey);
    router.get('/api/reviewable-products', isAuthenticated, userController.getReviewableProducts);
    router.get('/api/bookings', isAuthenticated, bookingController.getUserBookings);
    router.get('/api/bookings/:id', isAuthenticated, bookingController.getBookingById);
    router.put('/api/bookings/:id/cancel', isAuthenticated, bookingController.cancelBooking);
    router.put('/api/bookings/:id/payment-status', isAuthenticated, bookingController.updateBookingPaymentStatus);
    router.post('/api/bookings/:id/confirm', isAuthenticated, bookingController.confirmBookingDirectly);
    
    // Payment callback routes (no auth required for MoMo callbacks)
    router.post('/api/payment/momo/callback', bookingController.momoPaymentCallback);
    // MoMo may redirect the user agent via GET; accept GET as well as POST (IPN)
    router.get('/api/payment/momo/callback', bookingController.momoPaymentCallback);
    // User redirect return – after payment MoMo sends user here (GET); we update status then redirect to frontend
    router.get('/api/payment/momo/return', bookingController.momoPaymentReturn);

    // Customer-only routes (R1)
    router.post("/payment1", isAuthenticated, userController.handleMoMoPayment);

    // Admin-only routes (R2)
    router.get('/api/get-data-chart', isAdmin, adminController.handleDataChart);
    router.get('/api/analysis/stats', isAdmin, adminService.handleStats );
    router.get('/api/analysis/years', isAdmin, adminService.getAvailableYears);
    router.post('/api/analysis/calculate-elasticity', isAdmin, adminService.calculateAndStoreElasticity);
    router.get('/api/analysis/price-optimization', isAdmin, adminController.getPriceOptimizationSuggestions);
    router.get('/api/analysis/status', isAdmin, adminService.handleStatus);
    router.get('/api/analysis/crosstab', isAdmin, adminService.handleCrossTab);
    router.get('/api/analysis/chi-square', isAdmin, adminService.handleChiSquareAnalysis);
    router.get('/api/analysis/users', isAdmin, adminService.getAllUsers);
    router.get('/api/admin/products', isAdmin, adminController.getProducts);
    router.post('/api/create', isAdmin, adminController.getHandleCreate);
    router.put('/api/update', isAdmin, adminController.getHandleUpdate);
    router.delete('/api/delete', isAdmin, adminController.deleteProduct);
    router.get('/api/admin/categories', isAdmin, adminController.getCategories);
    router.get('/api/admin/countries', isAdmin, adminController.getCountries);
    router.post('/api/admin/update-time-travel', isAdmin, adminController.getHandleUpdateTimeTravel);
    router.get('/api/admin/order', isAdmin, adminController.getTimeTravel);
    router.get('/api/travel-dates', optionalAuth, adminController.getTravelDatesByProductId);
    // Import tourism dataset CSV into tourism_data table (admin only)
    router.post('/api/admin/import-tourism-data', isAdmin, adminService.importTourismData);
    // A/B experiment endpoints
    router.post('/api/admin/experiment/price', isAdmin, experimentController.setPriceExperiment);
    router.get('/api/admin/experiment/price/report', isAdmin, experimentController.getPriceExperimentReport);
    router.post('/api/experiment/exposure', isAuthenticated, experimentController.logExposure);
    return app.use("/", router);
}

export default initWebRoutes;