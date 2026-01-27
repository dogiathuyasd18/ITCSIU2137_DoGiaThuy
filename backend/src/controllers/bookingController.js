import db from '../models/index.js';
import bookingService from '../services/bookingService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const generateRandomPassword = () => {
    // Guests won't log in; this prevents storing a blank password
    return `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

// Test database connection and models
let testDatabase = async (req, res) => {
    try {
        console.log('Testing database connection and models...');
        
        // Test database connection
        await db.sequelize.authenticate();
        console.log('Database connection successful');
        
        // Test models
        const models = Object.keys(db);
        console.log('Available models:', models);
        
        // Test User model
        const userCount = await db.User.count();
        console.log('User count:', userCount);
        
        // Test Product model
        const productCount = await db.Product.count();
        console.log('Product count:', productCount);
        
        // Test ProductItem model
        const productItemCount = await db.ProductItem.count();
        console.log('ProductItem count:', productItemCount);
        
        // Test ShopOrder model
        const shopOrderCount = await db.ShopOrder.count();
        console.log('ShopOrder count:', shopOrderCount);
        
        // Test PaymentType model
        const paymentTypeCount = await db.PaymentType.count();
        console.log('PaymentType count:', paymentTypeCount);
        
        // Test UserPaymentMethod model
        const userPaymentMethodCount = await db.UserPaymentMethod.count();
        console.log('UserPaymentMethod count:', userPaymentMethodCount);
        
        res.status(200).json({
            errCode: 0,
            message: 'Database connection successful',
            data: {
                models: models,
                counts: {
                    users: userCount,
                    products: productCount,
                    productItems: productItemCount,
                    shopOrders: shopOrderCount,
                    paymentTypes: paymentTypeCount,
                    userPaymentMethods: userPaymentMethodCount
                }
            }
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            errCode: 500,
            message: 'Database test failed: ' + error.message
        });
    }
};

// Initialize default payment methods
let initializePaymentMethods = async (req, res) => {
    try {
        console.log('Initializing default payment methods...');
        
        // Check if payment types exist
        let paymentType = await db.PaymentType.findOne();
        if (!paymentType) {
            console.log('Creating default payment type...');
            paymentType = await db.PaymentType.create({
                name: 'Credit Card',
                description: 'Default credit card payment method'
            });
            console.log('Created payment type:', paymentType);
        }
        
        // Check if user has any payment methods
        const userId = req.currentUser?.id;
        if (userId) {
            const userPaymentMethods = await db.UserPaymentMethod.findAll({
                where: { user_id: userId }
            });
            
            if (userPaymentMethods.length === 0) {
                console.log('Creating default payment method for user:', userId);
                const defaultPaymentMethod = await db.UserPaymentMethod.create({
                    user_id: userId,
                    payment_type_id: paymentType.id,
                    card_number: '0000-0000-0000-0000',
                    expiry_date: '12/25',
                    cardholder_name: 'Default Payment Method',
                    is_default: true
                });
                console.log('Created default payment method:', defaultPaymentMethod);
            }
        }
        
        res.status(200).json({
            errCode: 0,
            message: 'Payment methods initialized successfully'
        });
    } catch (error) {
        console.error('Error initializing payment methods:', error);
        res.status(500).json({
            errCode: 500,
            message: 'Failed to initialize payment methods: ' + error.message
        });
    }
};

// Create a new booking
let createBooking = async (req, res) => {
    try {
        console.log('Booking Controller: Creating booking with data:', req.body);
        console.log('Booking Controller: Current user:', req.currentUser);

        const { productId, quantity, travelDate, scheduleId, specialRequests, paymentMethodId, promotionId, userName,  orderDate } = req.body;
        const userId = req.currentUser?.id;

        if (!userId) {
            console.log('Booking Controller: No user ID found');
            return res.status(401).json({
                errCode: 401,
                message: 'User not authenticated'
            });
        }

        console.log('Booking Controller: User ID:', userId);

        if (!productId || !quantity || !travelDate || !paymentMethodId) {
            return res.status(400).json({
                errCode: 1,
                message: 'Missing required fields: productId, quantity, travelDate, paymentMethodId'
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                errCode: 2,
                message: 'Quantity must be greater than 0'
            });
        }

        // Create booking data
        const bookingData = {
            userId,
            productId,
            quantity,
            travelDate: new Date(travelDate),
            scheduleId: scheduleId || null,
            specialRequests: specialRequests || '',
            paymentMethodId,
            promotionId: promotionId || null, // Include promotion ID if provided
            userName,
            orderDate
        };

        console.log('Booking Controller: Calling bookingService.createBooking with:', bookingData);

        // Create booking
        const result = await bookingService.createBooking(bookingData);
        console.log('Booking Controller: bookingService result:', result);

        if (result && result.errCode === 0) {
            console.log('Booking Controller: Booking created successfully');
            return res.status(201).json({
                errCode: 0,
                message: 'Booking created successfully',
                booking: result.booking
            });
        } else {
            console.log('Booking Controller: Booking creation failed');
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Booking creation failed'
            });
        }
    } catch (error) {
        console.error('Booking Controller: Booking creation error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error during booking creation: ' + error.message
        });
    }
};

// Create booking for guest (no authentication). Guest must provide contact info.
let createGuestBooking = async (req, res) => {
    try {
        console.log('Booking Controller: Creating GUEST booking with data:', req.body);

        const {
            // Guest info
            email,
            phoneNumber,
            firstName,
            lastName,
            address,
            gender,
            // Booking info
            productId,
            quantity,
            travelDate,
            specialRequests,
            paymentMethodId,
            promotionId,
            scheduleId
        } = req.body;

        // Validate guest fields
        if (!email || !phoneNumber || !firstName || !lastName || !address || (gender === undefined || gender === null)) {
            return res.status(400).json({
                errCode: 1,
                message: 'Missing guest fields: email, phoneNumber, firstName, lastName, address, gender'
            });
        }

        // Validate booking fields
        if (!productId || !quantity || (!travelDate && !scheduleId)) {
            return res.status(400).json({
                errCode: 2,
                message: 'Missing booking fields: productId, quantity, travelDate or scheduleId'
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                errCode: 3,
                message: 'Quantity must be greater than 0'
            });
        }

        // Security: if email already exists, require login rather than allowing guest to place orders under an existing email.
        const existing = await db.User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({
                errCode: 4,
                message: 'This email is already registered. Please sign in to place an order.'
            });
        }

        // Create a guest user record (roleId=1). Password is random; guest won't authenticate.
        const rawPassword = generateRandomPassword();
        const hashedPassword = bcrypt.hashSync(rawPassword, bcrypt.genSaltSync(10));
        const genderBool = gender === true || gender === 'true' || gender === 1 || gender === '1';

        const guestUser = await db.User.create({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            address,
            phone_number: phoneNumber,
            gender: genderBool,
            roleId: 1
        });

        // Issue a short-lived token so guest can immediately pay via MoMo and poll booking status,
        // without requiring a manual login/registration flow.
        const access_token = jwt.sign(
            { email: guestUser.email, roleId: guestUser.roleId },
            "6e5e5d06-ad33-44ff-b2a7-f2658557b3c2",
            { expiresIn: "30m" }
        );

        const bookingData = {
            userId: guestUser.id,
            productId,
            quantity,
            travelDate: travelDate ? new Date(travelDate) : null,
            scheduleId: scheduleId || null,
            specialRequests: specialRequests || `Guest booking - ${firstName} ${lastName} (${email}, ${phoneNumber})`,
            // bookingService will auto-find/create a payment method if this is missing/invalid
            paymentMethodId: paymentMethodId || 1,
            promotionId: promotionId || null
        };

        const result = await bookingService.createBooking(bookingData);
        if (result && result.errCode === 0) {
            return res.status(201).json({
                errCode: 0,
                message: 'Guest booking created successfully',
                access_token,
                guestUser: {
                    id: guestUser.id,
                    email: guestUser.email,
                    roleId: guestUser.roleId,
                    firstName: guestUser.firstName,
                    lastName: guestUser.lastName
                },
                booking: result.booking
            });
        }

        // If booking creation failed, clean up the guest user to avoid orphan guest accounts.
        try {
            await guestUser.destroy();
        } catch (cleanupErr) {
            console.error('Booking Controller: Failed to cleanup guest user after booking failure:', cleanupErr);
        }

        return res.status(400).json({
            errCode: result?.errCode || 500,
            message: result?.message || 'Guest booking creation failed'
        });
    } catch (error) {
        console.error('Booking Controller: Guest booking error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error during guest booking creation: ' + error.message
        });
    }
};

let getUserBookings = async (req, res) => {
    try {
        console.log('Booking Controller: Getting user bookings');
        
        const userId = req.currentUser.id;

        const result = await bookingService.getUserBookings(userId);
        console.log('Booking Controller: getUserBookings result:', result);

        if (result && result.errCode === 0) {
            return res.status(200).json({
                errCode: 0,
                message: 'Bookings retrieved successfully',
                bookings: result.bookings
            });
        } else {
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Failed to retrieve bookings'
            });
        }
    } catch (error) {
        console.error('Booking Controller: Get user bookings error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

// Get booking by ID
let getBookingById = async (req, res) => {
    try {
        console.log('Booking Controller: Getting booking by ID:', req.params.id);
        
        const bookingId = req.params.id;
        const userId = req.currentUser.id; // From auth middleware

        const result = await bookingService.getBookingById(bookingId, userId);
        console.log('Booking Controller: getBookingById result:', result);

        if (result && result.errCode === 0) {
            return res.status(200).json({
                errCode: 0,
                message: 'Booking retrieved successfully',
                booking: result.booking
            });
        } else {
            return res.status(404).json({
                errCode: result?.errCode || 404,
                message: result?.message || 'Booking not found'
            });
        }
    } catch (error) {
        console.error('Booking Controller: Get booking by ID error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

// Cancel booking
let cancelBooking = async (req, res) => {
    try {
        console.log('Booking Controller: Cancelling booking:', req.params.id);
        
        const bookingId = req.params.id;
        const userId = req.currentUser.id; // From auth middleware

        const result = await bookingService.cancelBooking(bookingId, userId);
        console.log('Booking Controller: cancelBooking result:', result);

        if (result && result.errCode === 0) {
            return res.status(200).json({
                errCode: 0,
                message: 'Booking cancelled successfully',
                booking: result.booking
            });
        } else {
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Failed to cancel booking'
            });
        }
    } catch (error) {
        console.error('Booking Controller: Cancel booking error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

// Get all products (tours) for booking
let getProducts = async (req, res) => {
    try {

        console.log('Booking Controller: Getting all products');
        const userId = req.currentUser?.id;
        const result = await bookingService.getProducts({ userId });
        // console.log('Booking Controller: getProducts result:', result);

        // The service returns an array directly, not an object with errCode
        if (Array.isArray(result)) {
            return res.status(200).json({
                errCode: 0,
                message: 'Products retrieved successfully',
                products: result
            });
        } else {
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Failed to retrieve products'
            });
        }
        
    } catch (error) {
        console.error('Booking Controller: Get products error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

// Search products for header autocomplete (public)
let searchProducts = async (req, res) => {
    try {
        const q = (req.query.q || '').toString().trim();
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 8;

        if (!q) {
            return res.status(200).json({
                errCode: 0,
                message: 'OK',
                products: []
            });
        }

        const products = await bookingService.searchProducts(q, Number.isFinite(limit) ? limit : 8);
        return res.status(200).json({
            errCode: 0,
            message: 'OK',
            products
        });
    } catch (error) {
        console.error('Booking Controller: searchProducts error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Failed to search products: ' + error.message
        });
    }
};

// Update booking status after payment success
let updateBookingPaymentStatus = async (req, res) => {
    try {
        console.log('Booking Controller: Updating payment status for booking:', req.params.id);
        
        const bookingId = req.params.id;
        const userId = req.currentUser.id; // From auth middleware
        const { paymentStatus, transactionId } = req.body;

        const result = await bookingService.updatePaymentStatus(bookingId, userId, paymentStatus, transactionId);
        console.log('Booking Controller: updatePaymentStatus result:', result);

        if (result && result.errCode === 0) {
            return res.status(200).json({
                errCode: 0,
                message: 'Payment status updated successfully',
                booking: result.booking
            });
        } else {
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Failed to update payment status'
            });
        }
    } catch (error) {
        console.error('Booking Controller: Update payment status error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

// MoMo redirect return endpoint – user's browser lands here after payment (GET with query params).
// We process the result, update booking status, then redirect to the frontend.
let momoPaymentReturn = async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
        const payload = req.query;
        console.log('MoMo Payment Return (redirect) received:', payload);
        const { orderId, resultCode, message, amount, extraData } = payload;

        let bookingId = null;
        if (extraData) {
            try {
                let decodedData = extraData;
                try {
                    decodedData = Buffer.from(extraData, 'base64').toString('utf-8');
                } catch (_) {}
                const extraDataObj = JSON.parse(decodedData);
                bookingId = extraDataObj.bookingId;
            } catch (e) {
                console.error('MoMo Return: Could not parse extraData:', e.message);
            }
        }

        const normalizedResultCode = typeof resultCode === 'string' ? parseInt(resultCode, 10) : resultCode;
        const result = await bookingService.handlePaymentCallback(orderId, normalizedResultCode, message, amount, bookingId);

        if (result && result.errCode === 0 && (normalizedResultCode === 0 || normalizedResultCode === 9000)) {
            return res.redirect(`${frontendUrl}/bookings?status=Confirmed`);
        }
        return res.redirect(`${frontendUrl}/bookings`);
    } catch (error) {
        console.error('MoMo Payment Return error:', error);
        return res.redirect(`${frontendUrl}/bookings`);
    }
};

// MoMo payment callback endpoint (IPN – server-to-server from MoMo)
let momoPaymentCallback = async (req, res) => {
    try {
        // MoMo can call IPN via POST (req.body) and also redirect user via GET (req.query).
        const payload = (req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
        console.log('MoMo Payment Callback received:', payload);
        
        const { orderId, resultCode, message, payUrl, deeplink, amount, extraData } = payload;
        
        // Extract bookingId from extraData if available
        let bookingId = null;
        if (extraData) {
            try {
                // extraData might be base64 encoded
                let decodedData = extraData;
                try {
                    decodedData = Buffer.from(extraData, 'base64').toString('utf-8');
                    console.log('MoMo Callback: Decoded base64 extraData:', decodedData);
                } catch (base64Error) {
                    // If not base64, use as-is
                    console.log('MoMo Callback: extraData is not base64, using as-is:', extraData);
                }
                
                const extraDataObj = JSON.parse(decodedData);
                bookingId = extraDataObj.bookingId;
                if (bookingId) {
                    console.log('✅ MoMo Callback: Extracted bookingId from extraData:', bookingId);
                } else {
                    console.log('⚠️ MoMo Callback: extraData parsed but bookingId is null/undefined');
                }
            } catch (e) {
                console.error('❌ MoMo Callback: Could not parse extraData:', e.message);
                console.error('   extraData value:', extraData);
            }
        } else {
            console.log('⚠️ MoMo Callback: No extraData provided in callback');
        }
        
        // If no bookingId in extraData, try to find the most recent pending booking for the user
        // This is a fallback for when extraData is not available
        if (!bookingId) {
            console.log('⚠️ MoMo Callback: No bookingId in extraData, will search for most recent pending booking');
        }
        
        // Find booking by bookingId or search by orderId/status
        const normalizedResultCode = typeof resultCode === 'string' ? parseInt(resultCode, 10) : resultCode;
        console.log('MoMo Callback: Normalized resultCode:', normalizedResultCode, 'Type:', typeof normalizedResultCode);
        console.log('MoMo Callback: bookingId extracted:', bookingId);
        
        const result = await bookingService.handlePaymentCallback(orderId, normalizedResultCode, message, amount, bookingId);
        
        console.log('MoMo Callback: Service result:', JSON.stringify(result, null, 2));
        
        if (result && result.errCode === 0) {
            console.log('✅ MoMo Callback: Payment processed successfully');
            return res.status(200).json({
                errCode: 0,
                message: 'Payment callback processed successfully',
                booking: result.booking
            });
        } else {
            console.error('❌ MoMo Callback: Failed to process callback. Error:', result?.message || 'Unknown error');
            console.error('   Error code:', result?.errCode || 'N/A');
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Failed to process payment callback'
            });
        }
    } catch (error) {
        console.error('❌ MoMo Payment Callback error:', error);
        console.error('   Error stack:', error.stack);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

// Directly confirm a booking (bypass payment gateway)
let confirmBookingDirectly = async (req, res) => {
    try {
        console.log('Booking Controller: Directly confirming booking:', req.params.id);
        
        const bookingId = req.params.id;
        const userId = req.currentUser.id; // From auth middleware

        const result = await bookingService.confirmBookingDirectly(bookingId, userId);
        console.log('Booking Controller: confirmBookingDirectly result:', result);

        if (result && result.errCode === 0) {
            return res.status(200).json({
                errCode: 0,
                message: 'Booking confirmed successfully',
                booking: result.booking
            });
        } else {
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Failed to confirm booking'
            });
        }
    } catch (error) {
        console.error('Booking Controller: Direct confirmation error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

// Get active promotions
let getActivePromotions = async (req, res) => {
    try {
        console.log('Booking Controller: Getting active promotions');
        const result = await bookingService.getActivePromotions();
        
        if (result && result.errCode === 0) {
            return res.status(200).json({
                errCode: 0,
                message: 'Active promotions retrieved successfully',
                promotions: result.promotions
            });
        } else {
            return res.status(400).json({
                errCode: result?.errCode || 500,
                message: result?.message || 'Failed to retrieve promotions'
            });
        }
    } catch (error) {
        console.error('Booking Controller: Get active promotions error:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal server error: ' + error.message
        });
    }
};

export default {
    testDatabase,
    initializePaymentMethods,
    createBooking,
    createGuestBooking,
    searchProducts,
    getUserBookings,
    getBookingById,
    cancelBooking,
    getProducts,
    updateBookingPaymentStatus,
    momoPaymentCallback,
    momoPaymentReturn,
    confirmBookingDirectly,
    getActivePromotions
};










