import db from '../models/index.js';
import experimentService from './experimentService.js';

// Logged-in payment window: 8 hours to finish MoMo payment; otherwise booking is auto-cancelled.
const PAYMENT_WINDOW_MS = 8 * 60 * 60 * 1000;

const isPaymentWindowExpired = (orderDate) => {
    if (!orderDate) return false;
    const t = new Date(orderDate).getTime();
    if (!Number.isFinite(t)) return false;
    return (Date.now() - t) > PAYMENT_WINDOW_MS;
};

// Auto-cancel pending bookings for a user that have exceeded the payment window.
// This is invoked on read paths to keep behavior consistent without needing a cron job.
let cancelExpiredPendingBookingsForUser = async (userId) => {
    try {
        const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MS);
        const expired = await db.ShopOrder.findAll({
            where: {
                user_id: userId,
                order_status: 'Pending',
                order_date: { [db.Sequelize.Op.lt]: cutoff }
            },
            attributes: ['id']
        });

        if (!expired || expired.length === 0) return;

        for (const b of expired) {
            // Reuse existing cancellation logic to restore schedule quantity.
            // Ignore errors per-order to avoid breaking the user's list view.
            try {
                await cancelBooking(b.id, userId);
            } catch (e) {
                console.error('bookingService: Failed to auto-cancel expired booking:', b.id, e);
            }
        }
    } catch (e) {
        console.error('bookingService: Error while auto-cancelling expired pending bookings:', e);
    }
};

// Helper function to automatically convert Confirmed orders to Completed if end_date has passed
let autoCompleteConfirmedOrders = async () => {
    try {
        const now = new Date();
        
        // Find all orders with Confirmed status that have schedule_id
        const confirmedOrders = await db.ShopOrder.findAll({
            where: {
                order_status: 'Confirmed'
            },
            attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
            include: [
                {
                    model: db.OrderLine,
                    where: {
                        schedule_id: {
                            [db.Sequelize.Op.ne]: null
                        }
                    },
                    required: true,
                    include: [
                        {
                            model: db.ProductSchedule,
                            attributes: ['id', 'end_date'],
                            required: true
                        }
                    ]
                }
            ]
        });

        let updatedCount = 0;
        
        for (const order of confirmedOrders) {
            for (const orderLine of order.OrderLines) {
                if (orderLine.ProductSchedule && orderLine.ProductSchedule.end_date) {
                    const endDate = new Date(orderLine.ProductSchedule.end_date);
                    
                    // If current time is past the end_date, update to Completed
                    if (now > endDate) {
                        // Ensure 'Completed' status exists
                        let completedStatus = await db.OrderStatus.findOne({
                            where: { status: 'Completed' }
                        });

                        if (!completedStatus) {
                            completedStatus = await db.OrderStatus.create({
                                status: 'Completed'
                            });
                        }

                        // Update order status to Completed
                        await order.update({
                            order_status: 'Completed'
                        });

                        // Update order_status_id in order_line to 2 (if it was Paid/Confirmed)
                        // Note: You might want to add a new status_id for Completed, or keep it as 2
                        await orderLine.update({
                            order_status_id: 2 // Keep as 2 (Paid) or you can add a new status_id for Completed
                        });

                        console.log('bookingService: Auto-completed order:', {
                            order_id: order.id,
                            end_date: endDate,
                            current_time: now
                        });
                        
                        updatedCount++;
                        break; // Only update once per order
                    }
                }
            }
        }

        if (updatedCount > 0) {
            console.log(`bookingService: Auto-completed ${updatedCount} order(s) that passed end_date`);
        }

        return updatedCount;
    } catch (error) {
        console.error('bookingService: Error in autoCompleteConfirmedOrders:', error);
        // Don't throw error, just log it
        return 0;
    }
};

// Create a new booking
let createBooking = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('bookingService: Creating booking with data:', data);
            console.log('bookingService: Available models:', Object.keys(db));
            
            const { userId, productId, quantity, travelDate, scheduleId, specialRequests, paymentMethodId, promotionId } = data;
            
            console.log('bookingService: Promotion ID received:', promotionId, typeof promotionId);
            console.log('bookingService: Received scheduleId:', scheduleId, 'travelDate:', travelDate);

            // Validate required fields
            if (!userId || !productId || !quantity || (!travelDate && !scheduleId) || !paymentMethodId) {
                console.log('bookingService: Missing required fields');
                resolve({
                    errCode: 1,
                    message: 'Missing required fields: userId, productId, quantity, travelDate or scheduleId, paymentMethodId'
                });
                return;
            }

            // Check if user exists
            // console.log('bookingService: Checking if user exists:', userId);
            const user = await db.User.findByPk(userId);
            if (!user) {
                console.log('bookingService: User not found');
                resolve({
                    errCode: 2,
                    message: 'User not found'
                });
                return;
            }
 
            // Check if product exists
            console.log('bookingService: Checking if product exists:', productId);
            const product = await db.Product.findOne({
                where: { id: productId }
            });

            if (!product) {
                console.log('bookingService: Product not found');
                resolve({
                    errCode: 3,
                    message: 'Product not found'
                });
                return;
            }
            // console.log('bookingService: Product found:', product.name);

            // Get product item for pricing
            const productItem = await db.ProductItem.findOne({
                where: { product_id: productId }
            });

            if (!productItem) {
                console.log('bookingService: Product item not found for productId:', productId);
                resolve({
                    errCode: 4,
                    message: 'Product item not found'
                });
                return;
            }
            console.log('bookingService: Product item found:', {
                id: productItem.id,
                product_id: productItem.product_id,
                price: productItem.price
            });

            // Find product_schedule by scheduleId (preferred) or travelDate (fallback)
            let productSchedule;
            
            if (scheduleId) {
                // Use schedule_id directly (more reliable)
                productSchedule = await db.ProductSchedule.findOne({
                    where: {
                        id: scheduleId,
                        product_item_id: productItem.id
                    }
                });
                
                if (!productSchedule) {
                    console.log('bookingService: Product schedule not found for schedule_id:', scheduleId);
                    resolve({
                        errCode: 11,
                        message: 'Selected travel date is not available for this tour'
                    });
                    return;
                }
            } else if (travelDate) {
                // Fallback to date-based lookup
                const travelDateObj = new Date(travelDate);
                const startOfDay = new Date(travelDateObj);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(travelDateObj);
                endOfDay.setHours(23, 59, 59, 999);
                
                productSchedule = await db.ProductSchedule.findOne({
                    where: {
                        product_item_id: productItem.id,
                        travel_date: {
                            [db.Sequelize.Op.gte]: startOfDay,
                            [db.Sequelize.Op.lt]: endOfDay
                        }
                    }
                });

                if (!productSchedule) {
                    console.log('bookingService: Product schedule not found for travel date:', travelDate);
                    resolve({
                        errCode: 11,
                        message: 'Selected travel date is not available for this tour'
                    });
                    return;
                }
            } else {
                resolve({
                    errCode: 11,
                    message: 'Travel date or schedule ID is required'
                });
                return;
            }

            // Booking rule: customer cannot order 1 day before tour start (and not on start day).
            // Require start_date to be at least 2 days after today.
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const start = new Date(productSchedule.travel_date);
                start.setHours(0, 0, 0, 0);
                const diffDays = (start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);

                if (diffDays <= 1) {
                    resolve({
                        errCode: 12,
                        message: 'You cannot book this tour 1 day before the start date. Please choose another travel date.'
                    });
                    return;
                }
            } catch (dateRuleErr) {
                console.error('bookingService: Error applying booking lead-time rule:', dateRuleErr);
                // If date parsing fails, fall back to existing behavior
            }

            // Check if there's enough quantity available in product_schedule
            const availableQuantity = parseInt(productSchedule.quantity || 0);
            const requestedQuantity = parseInt(quantity);
            
            console.log('bookingService: Checking schedule quantity:', {
                schedule_id: productSchedule.id,
                available_quantity: availableQuantity,
                requested_quantity: requestedQuantity
            });
            
            if (availableQuantity === 0) {
                console.log('bookingService: Schedule is out of stock');
                resolve({
                    errCode: 9,
                    message: 'Sorry, this travel date is out of stock. No tickets available.'
                });
                return;
            }
            
            if (requestedQuantity > availableQuantity) {
                console.log('bookingService: Requested quantity exceeds available quantity', {
                    requested: requestedQuantity,
                    available: availableQuantity
                });
                resolve({
                    errCode: 10,
                    message: `Sorry, you cannot order more than the available tickets. Only ${availableQuantity} ticket(s) remaining for this travel date.`
                });
                return;
            }

            // Apply price experiment (control vs treatment) if active.
            const expPricing = await experimentService.getPricingForUser(userId);
            const unitBase = Number(productItem.price || 0);
            const unitShown = expPricing?.active ? experimentService.applyPrice(unitBase, expPricing.multiplier) : Math.round(unitBase);

            // Calculate original total price using the shown unit price
            const originalPrice = unitShown * Number(quantity || 0);
            console.log('bookingService: Calculated original total price:', originalPrice, {
                experiment: expPricing?.active ? { variant: expPricing.variant, multiplier: expPricing.multiplier } : null
            });
            
            // Get promotion discount if promotionId is provided
            let promotion = null;
            let discountRate = 0;
            let finalPrice = originalPrice;
            
            if (promotionId) {
                try {
                    // Ensure promotionId is a number
                    const promoId = typeof promotionId === 'string' ? parseInt(promotionId) : promotionId;
                    console.log('bookingService: Looking up promotion with ID:', promoId, '(original:', promotionId, 'type:', typeof promotionId, ')');
                    promotion = await db.Promotion.findByPk(promoId);
                    if (promotion) {
                        console.log('bookingService: Found promotion:', promotion.name, 'discount_rate:', promotion.discount_rate);
                        const now = new Date();
                        const startDate = new Date(promotion.start_date);
                        const endDate = new Date(promotion.end_date);
                        
                        console.log('bookingService: Checking promotion dates:', {
                            now: now,
                            start_date: startDate,
                            end_date: endDate,
                            isActive: startDate <= now && endDate >= now
                        });
                        
                        // Check if promotion is still active
                        if (startDate <= now && endDate >= now) {
                            discountRate = parseFloat(promotion.discount_rate) || 0;
                            const discountAmount = originalPrice * discountRate / 100;
                            finalPrice = originalPrice - discountAmount;
                            
                            console.log('bookingService: ✅ Applied promotion:', {
                                promotionId: promotion.id,
                                name: promotion.name,
                                discountRate: discountRate,
                                originalPrice: originalPrice,
                                discountAmount: discountAmount,
                                finalPrice: finalPrice
                            });
                        } else {
                            console.log('bookingService: ⚠️ Promotion is not active, ignoring discount');
                            console.log('bookingService: Promotion dates:', {
                                start: startDate,
                                end: endDate,
                                now: now
                            });
                        }
                    } else {
                        console.log('bookingService: ❌ Promotion not found with ID:', promotionId);
                    }
                } catch (promoError) {
                    console.error('bookingService: Error getting promotion:', promoError);
                    console.error('bookingService: Promotion error details:', {
                        message: promoError.message,
                        name: promoError.name,
                        stack: promoError.stack
                    });
                    // Continue without discount if promotion lookup fails
                }
            } else {
                console.log('bookingService: No promotion ID provided, using original price');
            }
            
            // Use final price (after discount) for order_total (store as integer VND)
            const totalPrice = Math.round(Number(finalPrice || 0));
            console.log('bookingService: 💰 Price Summary:', {
                originalPrice: originalPrice,
                discountRate: discountRate,
                discountAmount: originalPrice * discountRate / 100,
                finalPrice: totalPrice,
                willBeStoredAs: totalPrice
            });

            // Get or create a valid payment method
            let validPaymentMethodId;
            try {
                // First, try to use the paymentMethodId from the request if provided
                if (paymentMethodId) {
                    const requestedPaymentMethod = await db.UserPaymentMethod.findByPk(paymentMethodId);
                    if (requestedPaymentMethod) {
                        validPaymentMethodId = paymentMethodId;
                        console.log('bookingService: Using requested payment method:', validPaymentMethodId);
                    } else {
                        console.log('bookingService: Requested payment method not found:', paymentMethodId);
                    }
                }

                // If requested payment method doesn't exist, find the first available one
                if (!validPaymentMethodId) {
                    const firstPaymentMethod = await db.UserPaymentMethod.findOne({
                        order: [['id', 'ASC']]
                    });
                    
                    if (firstPaymentMethod) {
                        validPaymentMethodId = firstPaymentMethod.id;
                        console.log('bookingService: Using first available payment method:', validPaymentMethodId);
                    } else {
                        console.log('bookingService: No payment methods found, creating default...');
                        // If no payment methods exist, create a default one using raw SQL to ensure it works
                        try {
                            // Try to find payment type - check both possible table names
                            let paymentTypeId;
                            let paymentTypes = [];
                            
                            // Try payment_types first (what the model uses)
                            try {
                                [paymentTypes] = await db.sequelize.query(
                                    'SELECT id FROM payment_types ORDER BY id ASC LIMIT 1'
                                );
                            } catch (e1) {
                                // Try payment_type (singular)
                                try {
                                    [paymentTypes] = await db.sequelize.query(
                                        'SELECT id FROM payment_type ORDER BY id ASC LIMIT 1'
                                    );
                                } catch (e2) {
                                    console.log('bookingService: Could not find payment_type table, will create one');
                                }
                            }
                            
                            if (paymentTypes && paymentTypes.length > 0) {
                                paymentTypeId = paymentTypes[0].id;
                                console.log('bookingService: Found payment type:', paymentTypeId);
                            } else {
                                // Create payment type using raw SQL - try both table names
                                try {
                                    await db.sequelize.query(
                                        'INSERT INTO payment_types (value) VALUES (1)'
                                    );
                                    [paymentTypes] = await db.sequelize.query(
                                        'SELECT id FROM payment_types WHERE value = 1 ORDER BY id DESC LIMIT 1'
                                    );
                                    paymentTypeId = paymentTypes[0].id;
                                    console.log('bookingService: Created default payment type (payment_types):', paymentTypeId);
                                } catch (e1) {
                                    try {
                                        await db.sequelize.query(
                                            'INSERT INTO payment_type (value) VALUES (1)'
                                        );
                                        [paymentTypes] = await db.sequelize.query(
                                            'SELECT id FROM payment_type WHERE value = 1 ORDER BY id DESC LIMIT 1'
                                        );
                                        paymentTypeId = paymentTypes[0].id;
                                        console.log('bookingService: Created default payment type (payment_type):', paymentTypeId);
                                    } catch (e2) {
                                        throw new Error('Could not create payment type in either payment_types or payment_type table');
                                    }
                                }
                            }

                            // Create payment method using raw SQL
                            await db.sequelize.query(
                                `INSERT INTO user_payment_method (provider, payment_type_id) VALUES ('Default', ${paymentTypeId})`
                            );
                            const [newPaymentMethods] = await db.sequelize.query(
                                `SELECT id FROM user_payment_method WHERE payment_type_id = ${paymentTypeId} ORDER BY id DESC LIMIT 1`
                            );
                            validPaymentMethodId = newPaymentMethods[0].id;
                            console.log('bookingService: Created default payment method using raw SQL:', validPaymentMethodId);
                        } catch (rawSQLError) {
                            console.error('bookingService: Error creating payment method with raw SQL:', rawSQLError);
                            // Try one more time with Sequelize models
                            try {
                                let defaultPaymentType = await db.PaymentType.findOne({
                                    order: [['id', 'ASC']]
                                });

                                if (!defaultPaymentType) {
                                    defaultPaymentType = await db.PaymentType.create({
                                        value: 1
                                    });
                                    console.log('bookingService: Created default payment type (Sequelize):', defaultPaymentType.id);
                                }

                                const defaultPaymentMethod = await db.UserPaymentMethod.create({
                                    provider: 'Default',
                                    payment_type_id: defaultPaymentType.id
                                });
                                validPaymentMethodId = defaultPaymentMethod.id;
                                console.log('bookingService: Created default payment method (Sequelize):', validPaymentMethodId);
                            } catch (sequelizeError) {
                                console.error('bookingService: Error creating payment method with Sequelize:', sequelizeError);
                                throw sequelizeError;
                            }
                        }
                    }
                }
            } catch (paymentMethodError) {
                console.error('bookingService: Error getting/creating payment method:', paymentMethodError);
                // Last resort: try raw SQL query to get any payment method
                try {
                    const [paymentMethods] = await db.sequelize.query(
                        'SELECT id FROM user_payment_method ORDER BY id ASC LIMIT 1'
                    );
                    if (paymentMethods && paymentMethods.length > 0) {
                        validPaymentMethodId = paymentMethods[0].id;
                        console.log('bookingService: Found payment method using raw SQL:', validPaymentMethodId);
                    } else {
                        throw new Error('No payment methods available in database');
                    }
                } catch (rawSQLFallbackError) {
                    console.error('bookingService: Raw SQL fallback also failed:', rawSQLFallbackError);
                    resolve({
                        errCode: 5,
                        message: 'Failed to get or create payment method: ' + rawSQLFallbackError.message
                    });
                    return;
                }
            }

            // Create shop order
            // console.log('bookingService: Creating shop order with data (ignoring user_payment_method):', {
            //     user_id: userId,
            //     order_date: new Date(),
            //     payment_method_id: validPaymentMethodId,
            //     order_total: totalPrice,
            //     order_status: 'Pending'
            // });

            // try {
            //     ProductItem = await db.ProductItem.create({
            //         stock_keeping_unit: 0,
            //         quantity_in_stock: quantity,
            //         price: totalPrice,
            //         product_id: productId,
            //         name: "",
            //         description: "",
            //         user: userName,
            //         date_order: orderDate,
            //         status: shopOrder.order_status,
            //     })
            // } catch (error) {
            // }

            try {
                // Get the user's current stats (handle null/undefined with || 0)
                const currentRevenue = parseFloat(user.revenue) || 0;
                const currentQuantity = parseInt(user.quantity) || 0;
                
                // Call .update() on the user object we already found
                await user.update({
                    revenue: currentRevenue + totalPrice,
                    quantity: currentQuantity + parseInt(quantity), // Assuming qtyToOrder = parseInt(quantity)
                    date_order: new Date() // Set their 'last order date'
                });
                console.log(`bookingService: User ${user.id} stats updated.`);
            } catch (userStatsError) {
                // This is a non-critical error, log it but don't stop the booking
                console.error('bookingService: Error updating user stats:', userStatsError.message);
            }

            // Ensure the 'Pending' status exists in order_statuses table
            let pendingStatus = await db.OrderStatus.findOne({
                where: { status: 'Pending' }
            });

            if (!pendingStatus) {
                console.log('bookingService: Status "Pending" not found, creating it...');
                pendingStatus = await db.OrderStatus.create({
                    status: 'Pending'
                });
                console.log('bookingService: Created status "Pending"');
            }

            // Final validation: ensure we have a valid payment method ID
            if (!validPaymentMethodId) {
                console.error('bookingService: No valid payment method ID found');
                resolve({
                    errCode: 5,
                    message: 'No valid payment method available. Please contact administrator.'
                });
                return;
            }

            // Final verification: ensure the payment method actually exists in the database using raw SQL
            try {
                const [verifyResult] = await db.sequelize.query(
                    `SELECT id FROM user_payment_method WHERE id = ${validPaymentMethodId} LIMIT 1`
                );
                
                if (!verifyResult || verifyResult.length === 0) {
                    console.error('bookingService: Payment method ID does not exist in database:', validPaymentMethodId);
                    // Get any existing payment method using raw SQL
                    const [anyPaymentMethods] = await db.sequelize.query(
                        'SELECT id FROM user_payment_method ORDER BY id ASC LIMIT 1'
                    );
                    
                    if (anyPaymentMethods && anyPaymentMethods.length > 0) {
                        validPaymentMethodId = anyPaymentMethods[0].id;
                        console.log('bookingService: Using alternative payment method from database:', validPaymentMethodId);
                    } else {
                        console.error('bookingService: No payment methods available in database');
                        resolve({
                            errCode: 5,
                            message: 'No payment methods available. Please contact administrator to set up payment methods.'
                        });
                        return;
                    }
                } else {
                    console.log('bookingService: Verified payment method exists in database:', validPaymentMethodId);
                }
            } catch (verifyError) {
                console.error('bookingService: Error verifying payment method with raw SQL:', verifyError);
                // Last attempt: try to get any payment method
                try {
                    const [anyPaymentMethods] = await db.sequelize.query(
                        'SELECT id FROM user_payment_method ORDER BY id ASC LIMIT 1'
                    );
                    if (anyPaymentMethods && anyPaymentMethods.length > 0) {
                        validPaymentMethodId = anyPaymentMethods[0].id;
                        console.log('bookingService: Using fallback payment method:', validPaymentMethodId);
                    } else {
                        throw new Error('No payment methods found in database');
                    }
                } catch (finalError) {
                    console.error('bookingService: Final fallback failed:', finalError);
                    resolve({
                        errCode: 5,
                        message: 'Failed to verify payment method: ' + finalError.message
                    });
                    return;
                }
            }

            console.log('bookingService: Using payment method ID:', validPaymentMethodId);

            let shopOrder;
            try {
                console.log('bookingService: Creating shop order with discounted price:', totalPrice);
                
                // Create shop order with all columns from database schema
                shopOrder = await db.ShopOrder.create({
                    user_id: userId,
                    // Store exact booking time in DB (millisecond precision). Requires order_date to be DATETIME(3).
                    order_date: db.sequelize.literal('CURRENT_TIMESTAMP(3)'),
                    payment_method_id: validPaymentMethodId,
                    order_total: totalPrice, // This is the discounted price (e.g., 180 instead of 200)
                    order_status: 'Pending', // Default status
                    promotion_id: promotionId || null,
                    experiment_name: expPricing?.active ? expPricing.experiment_name : null,
                    variant: expPricing?.active ? expPricing.variant : null,
                    price_multiplier: expPricing?.active ? expPricing.multiplier : null
                });
                console.log('bookingService: ✅ Shop order created successfully:', {
                    orderId: shopOrder.id,
                    order_total: shopOrder.order_total,
                    payment_method_id: validPaymentMethodId
                });
            } catch (error) {
                console.error('bookingService: Error creating shop order:', error);
                console.error('bookingService: Shop order error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                resolve({
                    errCode: 5,
                    message: 'Failed to create shop order: ' + error.message
                });
                return;
            }

            // Create order line
            let orderLine;
            try {
                // Verify productItem has an id
                if (!productItem.id) {
                    console.error('bookingService: ProductItem missing id field:', productItem);
                    throw new Error('ProductItem missing id field');
                }

                console.log('bookingService: Creating order line with:', {
                    product_item_id: productItem.id,
                    order_id: shopOrder.id,
                    quantity: quantity,
                    price: unitShown
                });

                orderLine = await db.OrderLine.create({
                    product_item_id: productItem.id,
                    order_id: shopOrder.id,
                    quantity: quantity,
                    price: unitShown,
                    order_status_id: 1, // Set to 1 when booking is created
                    schedule_id: productSchedule.id // Store the schedule_id for cancellation
                });
                console.log('bookingService: Order line created successfully with status_id=1 and schedule_id:', {
                    orderLineId: orderLine.id,
                    schedule_id: productSchedule.id
                });

                // Decrease quantity in product_schedule
                const newQuantity = availableQuantity - requestedQuantity;
                await productSchedule.update({
                    quantity: newQuantity
                });
                console.log('bookingService: Updated product schedule quantity:', {
                    schedule_id: productSchedule.id,
                    old_quantity: availableQuantity,
                    new_quantity: newQuantity,
                    quantity_ordered: requestedQuantity
                });
            } catch (error) {
                console.error('bookingService: Error creating order line:', error);
                console.error('bookingService: Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                // Try to clean up the shop order if order line creation fails
                try {
                    await db.ShopOrder.destroy({ where: { id: shopOrder.id } });
                    console.log('bookingService: Cleaned up shop order after order line creation failure');
                } catch (cleanupError) {
                    console.error('bookingService: Error cleaning up shop order:', cleanupError);
                }
                resolve({
                    errCode: 6,
                    message: 'Failed to create order line: ' + error.message
                });
                return;
            }

            // Get the complete booking with product details
            let booking;
            try {
                booking = await db.ShopOrder.findOne({
                    where: { id: shopOrder.id },
                    attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
                    include: [
                        {
                            model: db.OrderLine,
                            include: [
                                {
                                    model: db.ProductItem,
                                    include: [
                                        {
                                            model: db.Product
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            model: db.OrderStatus
                        }
                    ]
                });

                console.log('bookingService: Booking retrieved successfully:', booking ? 'Found' : 'Not found');

                if (!booking) {
                    console.log('bookingService: Failed to retrieve created booking');
                    resolve({
                        errCode: 7,
                        message: 'Failed to retrieve created booking'
                    });
                    return;
                }

                // Handle the case where OrderLines might be empty or Product might not be loaded
                const orderLine = booking.OrderLines && booking.OrderLines[0];
                const productItem = orderLine?.ProductItem;
                const product = productItem?.Product;

                // Calculate original price and discount info for response
                const orderLinePrice = orderLine?.price || productItem?.price || 0;
                const orderQuantity = orderLine?.quantity || quantity;
                const originalTotal = orderLinePrice * orderQuantity;
                const finalTotal = parseFloat(booking.order_total || 0);
                const calculatedDiscountAmount = originalTotal - finalTotal;
                const calculatedDiscountRate = originalTotal > 0 ? (calculatedDiscountAmount / originalTotal) * 100 : 0;
                
                console.log('bookingService: Booking response data:', {
                    orderTotal: finalTotal,
                    originalTotal: originalTotal,
                    discountAmount: calculatedDiscountAmount,
                    discountRate: calculatedDiscountRate,
                    promotionName: promotion?.name || 'None'
                });
                
                resolve({
                    errCode: 0,
                    message: 'Booking created successfully',
                    booking: {
                        id: booking.id,
                        orderDate: booking.order_date,
                        orderTotal: finalTotal, // This is the final price after discount (e.g., 180 instead of 200)
                        originalTotal: originalTotal, // Original price before discount
                        discountAmount: calculatedDiscountAmount, // Discount amount
                        discountRate: calculatedDiscountRate, // Discount percentage
                        promotionName: promotion?.name || null, // Promotion name if applied
                        orderStatus: booking.order_status,
                        productName: product?.name || 'Unknown Product',
                        quantity: orderQuantity,
                        price: orderLinePrice, // Price per person
                        travelDate: travelDate,
                        specialRequests: specialRequests
                    }
                });
            } catch (error) {
                console.error('bookingService: Error retrieving booking:', error);
                console.error('bookingService: Booking retrieval error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                resolve({
                    errCode: 8,
                    message: 'Failed to retrieve booking: ' + error.message
                });
            }
        } catch (e) {
            console.error('bookingService: Error creating booking:', e);
            reject(e);
        }
    });
};

// Get user's bookings
let getUserBookings = async (userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('bookingService: Getting bookings for user:', userId);

            // Disabled: Auto-complete orders that have passed end_date before fetching
            // await autoCompleteConfirmedOrders();
            // Auto-cancel pending orders older than the payment window (8 hours)
            await cancelExpiredPendingBookingsForUser(userId);

            const bookings = await db.ShopOrder.findAll({
                where: { user_id: userId },
                attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
                include: [
                    {
                        model: db.OrderLine,
                        include: [
                            {
                                model: db.ProductItem,
                                include: [
                                    {
                                        model: db.Product,
                                        as: 'Product'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        model: db.OrderStatus,
                        as: 'OrderStatus'
                    }
                ],
                order: [['order_date', 'DESC']]
            });

            console.log('bookingService: Found bookings:', bookings.length);

            const formattedBookings = bookings.map(booking => {
                // Calculate original price and discount info
                const orderLine = booking.OrderLines[0];
                const pricePerPerson = parseFloat(orderLine?.price || 0);
                const quantity = parseInt(orderLine?.quantity || 0);
                const originalTotal = pricePerPerson * quantity;
                const finalTotal = parseFloat(booking.order_total || 0);
                const discountAmount = originalTotal - finalTotal;
                const discountRate = originalTotal > 0 ? (discountAmount / originalTotal) * 100 : 0;
                
                return {
                    id: booking.id,
                    orderDate: booking.order_date,
                    orderTotal: finalTotal, // Final price after discount
                    originalTotal: originalTotal, // Original price before discount
                    discountAmount: discountAmount > 0 ? discountAmount : 0, // Discount amount
                    discountRate: discountRate > 0 ? discountRate : 0, // Discount percentage
                    orderStatus: booking.order_status,
                    productName: booking.OrderLines[0]?.ProductItem?.Product?.name,
                    quantity: quantity,
                    price: pricePerPerson // Price per person
                };
            });

            resolve({
                errCode: 0,
                message: 'Bookings retrieved successfully',
                bookings: formattedBookings
            });
        } catch (e) {
            console.error('bookingService: Error getting user bookings:', e);
            reject(e);
        }
    });
};

// Get booking by ID
let getBookingById = async (bookingId, userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('bookingService: Getting booking by ID:', bookingId, 'for user:', userId);

            // Disabled: Auto-complete orders that have passed end_date before fetching
            // await autoCompleteConfirmedOrders();
            // Auto-cancel pending orders older than the payment window (8 hours)
            await cancelExpiredPendingBookingsForUser(userId);

            const booking = await db.ShopOrder.findOne({
                where: { 
                    id: bookingId,
                    user_id: userId // Ensure user can only access their own bookings
                },
                attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
                include: [
                    {
                        model: db.OrderLine,
                        include: [
                            {
                                model: db.ProductItem,
                                include: [
                                    {
                                        model: db.Product,
                                        as: 'Product'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        model: db.OrderStatus,
                        as: 'OrderStatus'
                    }
                ]
            });

            if (!booking) {
                console.log('bookingService: Booking not found');
                resolve({
                    errCode: 1,
                    message: 'Booking not found'
                });
                return;
            }

            console.log('bookingService: Booking found:', booking);

                // Calculate original price and discount info
                const orderLine = booking.OrderLines[0];
                const pricePerPerson = parseFloat(orderLine?.price || 0);
                const quantity = parseInt(orderLine?.quantity || 0);
                const originalTotal = pricePerPerson * quantity;
                const finalTotal = parseFloat(booking.order_total || 0);
                const discountAmount = originalTotal - finalTotal;
                const discountRate = originalTotal > 0 ? (discountAmount / originalTotal) * 100 : 0;
                
                const formattedBooking = {
                    id: booking.id,
                    orderDate: booking.order_date,
                    orderTotal: finalTotal, // Final price after discount
                    originalTotal: originalTotal, // Original price before discount
                    discountAmount: discountAmount > 0 ? discountAmount : 0, // Discount amount
                    discountRate: discountRate > 0 ? discountRate : 0, // Discount percentage
                    orderStatus: booking.order_status,
                    productName: booking.OrderLines[0]?.ProductItem?.Product?.name,
                    quantity: quantity,
                    price: pricePerPerson // Price per person
                };

            resolve({
                errCode: 0,
                message: 'Booking retrieved successfully',
                booking: formattedBooking
            });
        } catch (e) {
            console.error('bookingService: Error getting booking by ID:', e);
            reject(e);
        }
    });
};

// Cancel booking
let cancelBooking = async (bookingId, userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('bookingService: Cancelling booking:', bookingId, 'for user:', userId);

            const booking = await db.ShopOrder.findOne({
                where: { 
                    id: bookingId,
                    user_id: userId
                },
                attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status']
            });

            if (!booking) {
                console.log('bookingService: Booking not found');
                resolve({
                    errCode: 1,
                    message: 'Booking not found'
                });
                return;
            }

            // Check if booking can be cancelled (not already cancelled or completed)
            if (booking.order_status === 'Cancelled' || booking.order_status === 'Completed') {
                console.log('bookingService: Booking cannot be cancelled, status:', booking.order_status);
                resolve({
                    errCode: 2,
                    message: 'Booking cannot be cancelled in its current status'
                });
                return;
            }

            // Ensure the 'Cancelled' status exists in order_statuses table
            let cancelledStatus = await db.OrderStatus.findOne({
                where: { status: 'Cancelled' }
            });

            if (!cancelledStatus) {
                console.log('bookingService: Status "Cancelled" not found, creating it...');
                cancelledStatus = await db.OrderStatus.create({
                    status: 'Cancelled'
                });
                console.log('bookingService: Created status "Cancelled"');
            }

            // Update booking status to cancelled
            await booking.update({
                order_status: 'Cancelled'
            });

            // Update order_status_id in order_line to 4 (Cancelled)
            const orderLines = await db.OrderLine.findAll({
                where: { order_id: bookingId },
                include: [
                    {
                        model: db.ProductItem
                    }
                ]
            });

            for (const orderLine of orderLines) {
                await orderLine.update({
                    order_status_id: 4 // 4 = Cancelled
                });
                
                // Restore quantity in product_schedule when cancelling using schedule_id
                if (orderLine.schedule_id) {
                    const productSchedule = await db.ProductSchedule.findByPk(orderLine.schedule_id);
                    
                    if (productSchedule) {
                        const cancelledQuantity = parseInt(orderLine.quantity || 0);
                        const currentQuantity = parseInt(productSchedule.quantity || 0);
                        const newQuantity = currentQuantity + cancelledQuantity;
                        
                        await productSchedule.update({
                            quantity: newQuantity
                        });
                        
                        console.log('bookingService: Restored quantity in product_schedule for cancelled booking:', {
                            schedule_id: productSchedule.id,
                            product_item_id: productSchedule.product_item_id,
                            restored_quantity: cancelledQuantity,
                            old_quantity: currentQuantity,
                            new_quantity: newQuantity
                        });
                    } else {
                        console.warn('bookingService: Schedule not found for schedule_id:', orderLine.schedule_id);
                    }
                } else {
                    console.warn('bookingService: No schedule_id found in order_line, cannot restore quantity:', {
                        order_line_id: orderLine.id,
                        order_id: bookingId
                    });
                }
            }

            console.log('bookingService: Booking cancelled successfully, order_status_id set to 4');

            resolve({
                errCode: 0,
                message: 'Booking cancelled successfully',
                booking: {
                    id: booking.id,
                    orderStatus: 'Cancelled'
                }
            });
        } catch (e) {
            console.error('bookingService: Error cancelling booking:', e);
            reject(e);
        }
    });
};

let getProducts = async (options = {}) => {
    try {
        const whereClause = {};
        if (options.stock_keeping_unit) {
            whereClause.stock_keeping_unit = options.stock_keeping_unit;
        }

        const productItems = await db.ProductItem.findAll({
            where: whereClause,
            // Include related models to avoid "Unknown column" errors
            include: [
                {
                    model: db.Product,
                    attributes: ['id', 'name', 'category_id', 'country_id'],
                    include: [
                        { 
                            model: db.ProductCategory, 
                            attributes: ['category_name'] 
                        },
                        { 
                            model: db.ProductCountry, 
                            attributes: ['country_name'] 
                        }
                    ]
                }
            ],
            order: [['stock_keeping_unit', 'ASC']]
        });

        // Return empty array if no data found
        if (!productItems || productItems.length === 0) {
            return [];
        }

        const userId = options.userId;
        const pricing = userId ? await experimentService.getPricingForUser(userId) : null;

        // Map the Sequelize objects to a clean JSON structure for the frontend
        return productItems.map(item => {
            const basePrice = item.price;
            const priceShown = pricing?.active ? experimentService.applyPrice(basePrice, pricing.multiplier) : Math.round(Number(basePrice || 0));
            return ({
            id: item.id, // ✅ Use product_item.id (unique) instead of product_id
            name: item.Product ? item.Product.name : "N/A",
            stock_keeping_unit: item.stock_keeping_unit,
            // price shown to the current user (experiment-aware)
            price: priceShown,
            basePrice: Math.round(Number(basePrice || 0)),
            experiment: pricing?.active ? { name: pricing.experiment_name, variant: pricing.variant, multiplier: pricing.multiplier } : null,
            description: item.description,
            product_id: item.product_id, // Keep this for reference
            product_item_id: item.id, // Add this for clarity
            categoryName: item.Product?.ProductCategory?.category_name || "Uncategorized",
            countryName: item.Product?.ProductCountry?.country_name || "Unknown",
            category_id: item.Product?.category_id,
            country_id: item.Product?.country_id
            });
        });
    } catch (error) {
        console.error("Error in getProducts service:", error);
        throw error;
    }
}

// Search products by name (case-insensitive contains match) for header autocomplete.
// Returns a lightweight list of suggestions.
let searchProducts = async (query, limit = 8) => {
    try {
        const q = (query || '').trim();
        if (!q) return [];

        const like = `%${q.toLowerCase()}%`;

        const rows = await db.Product.findAll({
            attributes: ['id', 'name'],
            where: db.Sequelize.where(
                db.Sequelize.fn('LOWER', db.Sequelize.col('name')),
                { [db.Sequelize.Op.like]: like }
            ),
            order: [['name', 'ASC']],
            limit: limit
        });

        return rows.map(r => ({
            id: r.id,
            name: r.name
        }));
    } catch (error) {
        console.error('Error in searchProducts service:', error);
        throw error;
    }
};
// Update payment status for a booking
let updatePaymentStatus = async (bookingId, userId, paymentStatus, transactionId) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('bookingService: Updating payment status for booking:', bookingId, 'status:', paymentStatus);

            const booking = await db.ShopOrder.findOne({
                where: { 
                    id: bookingId,
                    user_id: userId
                },
                attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
                include: [
                    {
                        model: db.OrderLine,
                        include: [
                            {
                                model: db.ProductItem,
                                include: [
                                    {
                                        model: db.Product,
                                        include: [
                                            {
                                                model: db.ProductCategory
                                            },
                                            {
                                                model: db.ProductCountry
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!booking) {
                console.log('bookingService: Booking not found');
                resolve({
                    errCode: 1,
                    message: 'Booking not found'
                });
                return;
            }

            // Enforce 8-hour payment window for logged-in users.
            // If payment arrives late, cancel and do not confirm.
            if ((paymentStatus === 'success' || paymentStatus === 'completed') &&
                booking.order_status === 'Pending' &&
                isPaymentWindowExpired(booking.order_date)) {
                await cancelBooking(bookingId, userId);
                resolve({
                    errCode: 13,
                    message: 'Payment window expired (8 hours). Booking has been cancelled.'
                });
                return;
            }

            // If gateway reports cancelled/failed, cancel booking to restore schedule quantity.
            if ((paymentStatus === 'failed' || paymentStatus === 'cancelled') && booking.order_status === 'Pending') {
                await cancelBooking(bookingId, userId);
                resolve({
                    errCode: 0,
                    message: 'Payment cancelled. Booking has been cancelled.',
                    booking: {
                        id: bookingId,
                        orderStatus: 'Cancelled',
                        transactionId
                    }
                });
                return;
            }

            // Update booking status based on payment status
            let newStatus = booking.order_status;
            if (paymentStatus === 'success' || paymentStatus === 'completed') {
                newStatus = 'Confirmed';
                
                console.log('bookingService: Payment successful, updating all related data...');
                
                // Ensure the 'Confirmed' status exists in order_status table
                // shop_order.order_status FK references order_status.status (string)
                // order_line.order_status_id FK references order_status.id (integer)
                // We need: status='Confirmed' AND id=2
                let confirmedStatus = await db.OrderStatus.findOne({
                    where: { status: 'Confirmed' }
                });

                if (!confirmedStatus) {
                    console.log('bookingService: Status "Confirmed" not found, creating it...');
                    // Try to create with id=2, or let it auto-increment
                    try {
                        confirmedStatus = await db.OrderStatus.create({
                            id: 2,
                            status: 'Confirmed'
                        });
                        console.log('bookingService: Created status "Confirmed" with id=2');
                    } catch (e) {
                        // If id=2 already exists, just create without id
                        confirmedStatus = await db.OrderStatus.create({
                            status: 'Confirmed'
                        });
                        console.log('bookingService: Created status "Confirmed" with auto id');
                    }
                        } else {
                    console.log(`bookingService: Confirmed status exists with id=${confirmedStatus.id}`);
                }

                // Get the confirmed status id (should be 2)
                const confirmedStatusId = confirmedStatus.id;

                // Update booking status to 'Confirmed'
                await booking.update({
                    order_status: 'Confirmed'
                });
                console.log('✅ shop_order.order_status updated to Confirmed');

                // Update order_status_id in order_line to 2 (Confirmed)
                const orderLines = await db.OrderLine.findAll({
                    where: { order_id: booking.id },
                    include: [
                        {
                            model: db.ProductItem
                        }
                    ]
                });

                for (const orderLine of orderLines) {
                    await orderLine.update({
                        order_status_id: confirmedStatusId // Use the actual id (should be 3)
                    });
                }

                console.log(`✅ Updated ${orderLines.length} order line(s): order_status_id from 1 to ${confirmedStatusId} (Confirmed)`);
                console.log(`bookingService: Booking confirmed successfully, order_status_id set to ${confirmedStatusId}`);
                    
                    // Reload booking with all necessary includes for tourism_data update
                    await booking.reload({
                        include: [
                            {
                                model: db.OrderLine,
                                include: [
                                    {
                                        model: db.ProductItem,
                                        include: [
                                            {
                                                model: db.Product,
                                                include: [
                                                    {
                                                        model: db.ProductCategory
                                                    },
                                                    {
                                                        model: db.ProductCountry
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    });
                
                // Update all related data automatically when payment completes
                try {
                    // 1. Update product metrics revenue and quantity
                    await updateProductMetricsRevenue(booking);
                    console.log('bookingService: Product metrics updated');
                } catch (error) {
                    console.error('bookingService: Error updating product metrics:', error);
                    // Continue with other updates even if this fails
                }
                
                try {
                    // 2. Update tourism_data table
                    await updateTourismData(booking);
                    console.log('bookingService: Tourism data updated');
                } catch (error) {
                    console.error('bookingService: Error updating tourism data:', error);
                    // Continue with other updates even if this fails
                }
                
                try {
                    // 3. Update user stats (revenue and quantity)
                    await updateUserStatsOnPaymentSuccess(booking);
                    console.log('bookingService: User stats updated');
                } catch (error) {
                    console.error('bookingService: Error updating user stats:', error);
                    // Continue with other updates even if this fails
                }
                
                console.log('bookingService: All automatic updates completed for payment success');
            } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
                newStatus = 'Cancelled';
                
                // Use transaction for cancellation too
                const transaction = await db.sequelize.transaction();
                try {
                    // Ensure Cancelled status exists
                    const [existingStatus] = await db.sequelize.query(
                        `SELECT id, status FROM order_status WHERE status = 'Cancelled' LIMIT 1`,
                        { type: db.sequelize.QueryTypes.SELECT, transaction: transaction }
                    );
                    
                    if (!existingStatus) {
                        await db.sequelize.query(
                            `INSERT INTO order_status (status) VALUES ('Cancelled')`,
                            { type: db.sequelize.QueryTypes.INSERT, transaction: transaction }
                        );
                    }
                    
                    await db.sequelize.query(
                        `UPDATE shop_order SET order_status = 'Cancelled' WHERE id = :bookingId`,
                        { 
                            replacements: { bookingId: booking.id },
                            type: db.sequelize.QueryTypes.UPDATE,
                            transaction: transaction
                        }
                    );
                    
                    await transaction.commit();
                    await booking.reload();
                } catch (error) {
                    await transaction.rollback();
                    throw error;
                }
            } else if (paymentStatus === 'pending') {
                newStatus = 'Pending';
            }

            console.log('bookingService: Payment status updated successfully to:', newStatus);

            resolve({
                errCode: 0,
                message: 'Payment status updated successfully',
                booking: {
                    id: booking.id,
                    orderStatus: newStatus,
                    transactionId: transactionId
                }
            });
        } catch (e) {
            console.error('bookingService: Error updating payment status:', e);
            console.error('bookingService: Error details:', {
                message: e.message,
                name: e.name,
                stack: e.stack
            });
            resolve({
                errCode: -1,
                message: 'Failed to update payment status: ' + e.message
            });
        }
    });
};

// Update tourism_data table when payment is successful
let updateTourismData = async (booking) => {
    try {
        console.log('bookingService: Updating tourism_data for booking:', booking.id);
        
        // Get order line data
        const orderLine = booking.OrderLines && booking.OrderLines[0];
        if (!orderLine || !orderLine.ProductItem || !orderLine.ProductItem.Product) {
            console.log('bookingService: No product data found in order line');
            return;
        }

        const product = orderLine.ProductItem.Product;
        const productCategory = product.ProductCategory;
        const productCountry = product.ProductCountry;
        const quantity = parseInt(orderLine.quantity) || 1; // Number of people
        const revenue = parseFloat(booking.order_total) || 0;
        
        // Get location_id from product name (truncate to 20 chars if needed)
        const locationId = product.name ? product.name.substring(0, 20) : null;
        if (!locationId) {
            console.log('bookingService: No product name found, skipping tourism_data update');
            return;
        }

        // Get category from ProductCategory
        const category = productCategory?.category_name || 'Uncategorized';
        
        // Get country name from ProductCountry
        const country = productCountry?.country_name || 'Unknown';

        // Get current year
        const currentYear = new Date().getFullYear();

        // Calculate rating using formula: rating = total_rating / total_visitors
        // Where total_rating = sum(quantity * rating) for each review
        // We need to find orders associated with each review to get the quantity
        let calculatedRating = null;
        try {
            const reviews = await db.UserReview.findAll({
                where: { product_id: product.id },
                attributes: ['id', 'user_id', 'rating']
            });
            
            if (reviews && reviews.length > 0) {
                let totalRating = 0;
                let totalVisitors = 0;
                
                // For each review, find the associated order to get quantity
                for (const review of reviews) {
                    // Find the order_line for this user and product
                    // We need to find order_lines that match this product (through product_item -> product)
                    const relatedOrderLine = await db.OrderLine.findOne({
                        include: [
                            {
                                model: db.ProductItem,
                                where: {
                                    product_id: product.id
                                },
                                required: true
                            },
                            {
                                model: db.ShopOrder,
                                where: {
                                    user_id: review.user_id,
                                    order_status: {
                                        [db.Sequelize.Op.in]: ['Confirmed', 'Completed']
                                    }
                                },
                                required: true
                            }
                        ],
                        order: [['id', 'DESC']], // Get the most recent order
                        limit: 1
                    });
                    
                    // If we found an order, use its quantity; otherwise use 1 as default
                    const reviewQuantity = relatedOrderLine ? parseInt(relatedOrderLine.quantity || 1) : 1;
                    const reviewRating = parseFloat(review.rating || 0);
                    
                    // Add to total_rating: quantity * rating
                    totalRating += reviewQuantity * reviewRating;
                    totalVisitors += reviewQuantity;
                }
                
                // Calculate rating = total_rating / total_visitors
                if (totalVisitors > 0) {
                    calculatedRating = parseFloat((totalRating / totalVisitors).toFixed(2));
                    console.log(`bookingService: Calculated rating: ${calculatedRating} (total_rating: ${totalRating}, total_visitors: ${totalVisitors})`);
                } else {
                    console.log('bookingService: No visitors found for rating calculation');
                }
            } else {
                console.log('bookingService: No reviews found for product, rating will be null');
            }
        } catch (ratingError) {
            console.error('bookingService: Error calculating rating:', ratingError);
        }

        // Find or create tourism_data entry
        let tourismData = await db.TourismData.findOne({
            where: { location_id: locationId }
        });

        if (tourismData) {
            // Update existing record
            const currentVisitors = parseInt(tourismData.visitors || 0);
            const currentRevenue = parseFloat(tourismData.revenue || 0);
            
            // Update with new values
            // Rating: use newly calculated average if available, otherwise keep existing
            await tourismData.update({
                visitors: currentVisitors + quantity,
                revenue: currentRevenue + revenue,
                rating: calculatedRating !== null ? calculatedRating : tourismData.rating,
                category: category, // Update category in case it changed
                country: country, // Update country in case it changed
                year: currentYear, // Update to current year
                accommodation_available: 0
            });
            
            console.log('bookingService: Updated tourism_data for location:', locationId);
        } else {
            // Create new record
            tourismData = await db.TourismData.create({
                location_id: locationId,
                country: country,
                category: category,
                visitors: quantity,
                rating: calculatedRating,
                revenue: revenue,
                year: currentYear, // Set to current year
                accommodation_available: 0
            });
            
            console.log('bookingService: Created new tourism_data entry for location:', locationId);
        }
    } catch (error) {
        console.error('bookingService: Error updating tourism_data:', error);
        // Don't throw error to avoid breaking the payment flow
    }
};

// Update user stats (revenue and quantity) when payment is successful
let updateUserStatsOnPaymentSuccess = async (booking) => {
    try {
        console.log('bookingService: Updating user stats for booking:', booking.id);
        
        // Get user from booking
        const userId = booking.user_id;
        if (!userId) {
            console.log('bookingService: No user_id found in booking');
            return;
        }
        
        const user = await db.User.findByPk(userId);
        if (!user) {
            console.log('bookingService: User not found:', userId);
            return;
        }
        
        // Get order line data
        const orderLine = booking.OrderLines && booking.OrderLines[0];
        if (!orderLine) {
            console.log('bookingService: No order line found');
            return;
        }
        
        const paymentAmount = parseFloat(booking.order_total) || 0;
        const bookingQuantity = parseInt(orderLine.quantity) || 1;
        
        // Get current user stats
        const currentRevenue = parseFloat(user.revenue) || 0;
        const currentQuantity = parseInt(user.quantity) || 0;
        
        // Update user stats
        await user.update({
            revenue: currentRevenue + paymentAmount,
            quantity: currentQuantity + bookingQuantity,
            date_order: new Date()
        });
        
        console.log('bookingService: User stats updated:', {
            userId,
            oldRevenue: currentRevenue,
            newRevenue: currentRevenue + paymentAmount,
            addedAmount: paymentAmount,
            oldQuantity: currentQuantity,
            newQuantity: currentQuantity + bookingQuantity,
            addedQuantity: bookingQuantity
        });
    } catch (error) {
        console.error('bookingService: Error updating user stats:', error);
        // Don't throw error to avoid breaking the payment flow
    }
};

// Update product metrics revenue and quantity when payment is successful
let updateProductMetricsRevenue = async (booking) => {
    try {
        console.log('bookingService: Updating product metrics revenue and quantity for booking:', booking.id);
        
        // Get the product from the order line
        const orderLine = booking.OrderLines[0];
        if (!orderLine || !orderLine.ProductItem) {
            console.log('bookingService: No product found in order line');
            return;
        }
        
        const productId = orderLine.ProductItem.product_id;
        const paymentAmount = parseFloat(booking.order_total);
        const bookingQuantity = parseInt(orderLine.quantity) || 1; // Number of people in booking
        
        console.log('bookingService: Product ID:', productId, 'Payment Amount:', paymentAmount, 'Quantity:', bookingQuantity);
        
        // Find existing product metrics
        let productMetrics = await db.ProductMetrics.findOne({
            where: { product_id: productId }
        });
        
        if (productMetrics) {
            // Update existing metrics
            const currentRevenue = parseFloat(productMetrics.revenue || 0);
            const currentQuantity = parseInt(productMetrics.quantity || 0);
            const newRevenue = currentRevenue + paymentAmount;
            const newQuantity = currentQuantity + bookingQuantity;
            
            await productMetrics.update({
                revenue: newRevenue,
                quantity: newQuantity
            });
            
            console.log('bookingService: Updated product metrics:', {
                productId,
                oldRevenue: currentRevenue,
                newRevenue: newRevenue,
                addedAmount: paymentAmount,
                oldQuantity: currentQuantity,
                newQuantity: newQuantity,
                addedQuantity: bookingQuantity
            });
        } else {
            // Create new product metrics entry
            await db.ProductMetrics.create({
                product_id: productId,
                revenue: paymentAmount,
                quantity: bookingQuantity,
                percent: 0,
                rating: 0
            });
            
            console.log('bookingService: Created new product metrics:', {
                productId,
                revenue: paymentAmount,
                quantity: bookingQuantity
            });
        }
    } catch (error) {
        console.error('bookingService: Error updating product metrics revenue and quantity:', error);
        // Don't throw error to avoid breaking the payment flow
    }
};

// Handle MoMo payment callback
let handlePaymentCallback = async (orderId, resultCode, message, amount, bookingId = null) => {
    return new Promise(async (resolve, reject) => {
        const transaction = await db.sequelize.transaction();
        try {
            console.log('bookingService: Handling payment callback for orderId:', orderId, 'resultCode:', resultCode, 'bookingId:', bookingId);

            // Find booking by bookingId if provided, otherwise try to find by orderId or search for pending bookings
            let booking = null;
            
            if (bookingId) {
                // Find booking by bookingId
                booking = await db.ShopOrder.findOne({
                    where: { id: bookingId },
                    attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
                    transaction,
                    include: [
                        {
                            model: db.OrderLine,
                            include: [
                                {
                                    model: db.ProductItem,
                                    include: [
                                        {
                                            model: db.Product,
                                            include: [
                                                {
                                                    model: db.ProductCategory
                                                },
                                                {
                                                    model: db.ProductCountry
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                });
                if (booking) {
                    console.log('✅ bookingService: Found booking by bookingId:', bookingId, 'Status:', booking.order_status);
                } else {
                    console.log('⚠️ bookingService: Booking not found by bookingId:', bookingId);
                }
            }
            
            // If booking not found by bookingId, try to find most recent pending booking
            // This is a fallback for when extraData is not available
            if (!booking) {
                console.log('bookingService: Booking not found by bookingId, searching for most recent pending booking');
                booking = await db.ShopOrder.findOne({
                    where: { 
                        order_status: 'Pending'
                    },
                    order: [['order_date', 'DESC']], // Get most recent pending booking
                    attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
                    transaction,
                    include: [
                        {
                            model: db.OrderLine,
                            include: [
                                {
                                    model: db.ProductItem,
                                    include: [
                                        {
                                            model: db.Product,
                                            include: [
                                                {
                                                    model: db.ProductCategory
                                                },
                                                {
                                                    model: db.ProductCountry
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                });
                if (booking) {
                    console.log('✅ bookingService: Found most recent pending booking:', booking.id, 'Status:', booking.order_status);
                } else {
                    console.log('⚠️ bookingService: No pending bookings found');
                }
            }

            if (!booking) {
                console.error('❌ bookingService: Booking not found for orderId:', orderId, 'bookingId:', bookingId);
                await transaction.rollback();
                resolve({
                    errCode: 1,
                    message: 'Booking not found. Please ensure the booking exists and is in Pending status.'
                });
                return;
            }

            const isPaymentSuccess = (resultCode === 0 || resultCode === 9000);
            // If payment succeeds but booking is outside the payment window, cancel it and do not confirm.
            if (isPaymentSuccess && booking.order_status === 'Pending' && isPaymentWindowExpired(booking.order_date)) {
                await transaction.rollback();
                await cancelBooking(booking.id, booking.user_id);
                resolve({
                    errCode: 13,
                    message: 'Payment window expired (8 hours). Booking has been cancelled.'
                });
                return;
            }

            // If MoMo indicates failure/cancel, do not change booking status (leave as Pending).
            if (!isPaymentSuccess && booking.order_status === 'Pending') {
                await transaction.commit();
                resolve({
                    errCode: 0,
                    message: 'Payment failed or cancelled. Booking status unchanged.',
                    booking: {
                        id: booking.id,
                        orderStatus: booking.order_status
                    }
                });
                return;
            }

            // Update status based on MoMo result code
            // When MoMo payment success (resultCode 0 or 9000), update order_status from 'Pending' to 'Confirmed'
            if (isPaymentSuccess) {
                // Payment successful - update status from 'Pending' to 'Confirmed'
                if (booking.order_status === 'Pending') {
                    console.log('=== PAYMENT SUCCESS - UPDATING STATUS ===');
                    console.log('bookingService: MoMo payment successful, updating booking status from Pending to Confirmed...');
                    console.log('   Booking ID:', booking.id);
                    console.log('   Current status:', booking.order_status);
                    
                    // Ensure the 'Confirmed' status exists in order_status table with id=2
                    // Note: Cannot update status if shop_order records reference it (FK constraint)
                    // Strategy: Check if id=2 with 'Confirmed' exists, if not create it (don't try to update existing)
                    console.log('bookingService: Ensuring "Confirmed" status with id=2 exists...');
                    
                    let confirmedStatus = await db.OrderStatus.findOne({
                        where: { 
                            id: 2,
                            status: 'Confirmed'
                        },
                        transaction
                    });
                    
                    if (!confirmedStatus) {
                        // Check if id=2 exists with different status
                        const id2Status = await db.OrderStatus.findOne({
                            where: { id: 2 },
                            transaction
                        });
                        
                        if (id2Status) {
                            // id=2 exists but with wrong status
                            // Check if any shop_order records reference this status
                            const [referencingOrders] = await db.sequelize.query(
                                `SELECT COUNT(*) as count FROM shop_order WHERE order_status = :status`,
                                {
                                    replacements: { status: id2Status.status },
                                    type: db.sequelize.QueryTypes.SELECT,
                                    transaction
                                }
                            );
                            
                            if (referencingOrders && referencingOrders.count > 0) {
                                console.log(`⚠️ bookingService: id=2 exists with status="${id2Status.status}" and ${referencingOrders.count} orders reference it. Cannot update due to FK constraint.`);
                                console.log('   Will use existing id=2 regardless of status name.');
                                // Use the existing id=2 even if status name is different
                                // The important thing is that order_line.order_status_id = 2
                                confirmedStatus = id2Status;
                            } else {
                                // No orders reference it, safe to update
                                console.log(`bookingService: id=2 exists with status="${id2Status.status}" but no orders reference it. Updating to "Confirmed"...`);
                                try {
                                    await id2Status.update({ status: 'Confirmed' }, { transaction });
                                    confirmedStatus = await db.OrderStatus.findOne({
                                        where: { id: 2, status: 'Confirmed' },
                                        transaction
                                    });
                                    console.log('✅ bookingService: Updated id=2 to status="Confirmed"');
                                } catch (updateError) {
                                    console.error('❌ bookingService: Error updating id=2 status:', updateError.message);
                                    // If update fails, use existing id=2 anyway
                                    confirmedStatus = id2Status;
                                    console.log('⚠️ bookingService: Using existing id=2 with status="' + id2Status.status + '"');
                                }
                            }
                        } else {
                            // id=2 doesn't exist - create it
                            console.log('bookingService: id=2 does not exist, creating with status="Confirmed"...');
                            try {
                                confirmedStatus = await db.OrderStatus.create({
                                    id: 2,
                                    status: 'Confirmed'
                                }, { transaction });
                                console.log('✅ bookingService: Created id=2 with status="Confirmed"');
                            } catch (createError) {
                                console.error('❌ bookingService: Error creating id=2:', createError.message);
                                // If creation failed, try SQL
                                try {
                                    await db.sequelize.query(
                                        `INSERT INTO order_status (id, status) VALUES (2, 'Confirmed')`,
                                        { transaction }
                                    );
                                    confirmedStatus = await db.OrderStatus.findOne({
                                        where: { id: 2, status: 'Confirmed' },
                                        transaction
                                    });
                                    console.log('✅ bookingService: Created id=2 via SQL');
                                } catch (sqlError) {
                                    console.error('❌ bookingService: SQL creation also failed:', sqlError.message);
                                    // Check if it was created by another transaction
                                    confirmedStatus = await db.OrderStatus.findOne({
                                        where: { id: 2 },
                                        transaction
                                    });
                                    if (!confirmedStatus) {
                                        throw new Error(`Failed to create or find id=2: ${sqlError.message}`);
                                    }
                                }
                            }
                        }
                    } else {
                        console.log(`✅ bookingService: id=2 with status="Confirmed" already exists`);
                    }
                    
                    // Final verification - must have id=2 (status name is less critical due to FK constraints)
                    if (!confirmedStatus || confirmedStatus.id !== 2) {
                        const currentId = confirmedStatus?.id || 'null';
                        const currentStatus = confirmedStatus?.status || 'null';
                        throw new Error(`Failed to ensure id=2 exists. Got id=${currentId}, status=${currentStatus}`);
                    }
                    
                    console.log(`✅ bookingService: Verified id=2 exists (status="${confirmedStatus.status}")`);

                    // Get the confirmed status id (must be 2) and status name
                    const confirmedStatusId = confirmedStatus.id;
                    const confirmedStatusName = confirmedStatus.status; // Use actual status name (may not be 'Confirmed' due to FK constraints)
                    console.log(`✅ bookingService: Using status id=${confirmedStatusId}, name="${confirmedStatusName}" for updates`);

                    // Update booking status to the actual status name (must match order_status.status due to FK)
                    const updateResult = await booking.update({
                        order_status: confirmedStatusName
                    }, { transaction });
                    console.log(`✅ shop_order.order_status updated to "${confirmedStatusName}"`);
                    console.log('   Update result:', updateResult ? 'Success' : 'Failed');

                    // Also update directly via SQL to ensure it's saved
                    await db.sequelize.query(
                        `UPDATE shop_order SET order_status = :statusName WHERE id = :bookingId`,
                        {
                            replacements: { statusName: confirmedStatusName, bookingId: booking.id },
                            type: db.sequelize.QueryTypes.UPDATE,
                            transaction
                        }
                    );
                    console.log(`✅ Direct SQL update executed for shop_order.order_status = "${confirmedStatusName}"`);

                    // Update order_status_id in order_line to 2 (Confirmed) within transaction
                    const orderLines = await db.OrderLine.findAll({
                        where: { order_id: booking.id },
                        transaction,
                        include: [
                            {
                                model: db.ProductItem
                            }
                        ]
                    });

                    console.log(`📋 Found ${orderLines.length} order line(s) to update`);

                    for (const orderLine of orderLines) {
                        const oldStatusId = orderLine.order_status_id;
                    await orderLine.update({
                            order_status_id: confirmedStatusId // Use the actual id (should be 2)
                        }, { transaction });
                        console.log(`   ✅ Updated order_line ID ${orderLine.id}: order_status_id ${oldStatusId} → ${confirmedStatusId}`);
                    }

                    // Also update directly via SQL to ensure it's saved
                    await db.sequelize.query(
                        `UPDATE order_line SET order_status_id = :statusId WHERE order_id = :bookingId`,
                        {
                            replacements: { statusId: confirmedStatusId, bookingId: booking.id },
                            type: db.sequelize.QueryTypes.UPDATE,
                            transaction
                        }
                    );
                    console.log(`✅ Direct SQL update executed for order_line.order_status_id = ${confirmedStatusId}`);

                    console.log(`✅ Updated ${orderLines.length} order line(s): order_status_id from 1 to ${confirmedStatusId} (Confirmed)`);
                    console.log(`bookingService: Booking confirmed successfully, order_status_id set to ${confirmedStatusId}`);
                    
                    // Commit the transaction to ensure all updates are saved
                    await transaction.commit();
                    console.log('✅ Transaction committed successfully');
                
                    // Reload booking to get fresh data from database (after transaction commit)
                    await booking.reload({
                        attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status']
                    });
                    
                    // Double-check by querying database directly
                    const [verifyBooking] = await db.sequelize.query(
                        `SELECT id, order_status FROM shop_order WHERE id = :bookingId`,
                        { 
                            replacements: { bookingId: booking.id },
                            type: db.sequelize.QueryTypes.SELECT
                        }
                    );
                    
                    const [verifyOrderLines] = await db.sequelize.query(
                        `SELECT id, order_status_id FROM order_line WHERE order_id = :bookingId`,
                        { 
                            replacements: { bookingId: booking.id },
                            type: db.sequelize.QueryTypes.SELECT
                        }
                    );
                    
                    console.log('🔍 Direct database verification:');
                    console.log(`   shop_order.order_status: ${verifyBooking?.order_status || 'NOT FOUND'}`);
                    if (verifyOrderLines && verifyOrderLines.length > 0) {
                        verifyOrderLines.forEach(ol => {
                            console.log(`   order_line ID ${ol.id}: order_status_id = ${ol.order_status_id}`);
                        });
                    }
                    
                    // Verify the update was successful
                    if (!verifyBooking) {
                        console.error('❌ ERROR: Booking not found in database after update!');
                        throw new Error('Booking not found after status update');
                    }
                    
                    if (verifyBooking.order_status !== confirmedStatusName) {
                        console.error(`❌ ERROR: Booking status was not updated correctly!`);
                        console.error(`   Expected: ${confirmedStatusName}`);
                        console.error(`   Actual: ${verifyBooking.order_status}`);
                        console.error('   Booking ID:', booking.id);
                        // Try one more direct update as fallback
                        await db.sequelize.query(
                            `UPDATE shop_order SET order_status = :statusName WHERE id = :bookingId`,
                            {
                                replacements: { statusName: confirmedStatusName, bookingId: booking.id },
                                type: db.sequelize.QueryTypes.UPDATE
                            }
                        );
                        console.log(`⚠️ Attempted fallback direct SQL update to "${confirmedStatusName}"`);
                        throw new Error(`Failed to update booking status. Expected '${confirmedStatusName}', got '${verifyBooking.order_status}'`);
                    }
                    
                    if (verifyOrderLines && verifyOrderLines.length > 0) {
                        const allUpdated = verifyOrderLines.every(ol => ol.order_status_id === confirmedStatusId);
                        if (!allUpdated) {
                            console.error('❌ ERROR: Not all order lines were updated!');
                            verifyOrderLines.forEach(ol => {
                                console.error(`   order_line ID ${ol.id}: expected ${confirmedStatusId}, got ${ol.order_status_id}`);
                            });
                            // Try one more direct update as fallback
                            await db.sequelize.query(
                                `UPDATE order_line SET order_status_id = :statusId WHERE order_id = :bookingId`,
                                {
                                    replacements: { statusId: confirmedStatusId, bookingId: booking.id },
                                    type: db.sequelize.QueryTypes.UPDATE
                                }
                            );
                            console.log('⚠️ Attempted fallback direct SQL update for order lines');
                            throw new Error(`Failed to update all order_line.order_status_id to ${confirmedStatusId}`);
                        }
                    } else {
                        console.warn('⚠️ No order lines found to verify');
                    }
                    
                    console.log('✅ VERIFIED: Booking status successfully updated to Confirmed');
                    console.log(`✅ VERIFIED: All order lines updated to order_status_id=${confirmedStatusId}`);
                    console.log(`✅ FINAL STATUS: shop_order.order_status='Confirmed', order_line.order_status_id=${confirmedStatusId}`);
                
                // Reload booking with all necessary includes for tourism_data update
                await booking.reload({
                    include: [
                        {
                            model: db.OrderLine,
                            include: [
                                {
                                    model: db.ProductItem,
                                    include: [
                                        {
                                            model: db.Product,
                                            include: [
                                                {
                                                    model: db.ProductCategory
                                                },
                                                {
                                                    model: db.ProductCountry
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                });
                
                // Update all related data automatically when payment completes
                try {
                    // 1. Update product metrics revenue and quantity
                    await updateProductMetricsRevenue(booking);
                    console.log('bookingService: Product metrics updated');
                } catch (error) {
                    console.error('bookingService: Error updating product metrics:', error);
                    // Continue with other updates even if this fails
                }
                
                try {
                    // 2. Update tourism_data table
                    await updateTourismData(booking);
                    console.log('bookingService: Tourism data updated');
                } catch (error) {
                    console.error('bookingService: Error updating tourism data:', error);
                    // Continue with other updates even if this fails
                }
                
                try {
                    // 3. Update user stats (revenue and quantity)
                    await updateUserStatsOnPaymentSuccess(booking);
                    console.log('bookingService: User stats updated');
                } catch (error) {
                    console.error('bookingService: Error updating user stats:', error);
                    // Continue with other updates even if this fails
                }
                
                console.log('bookingService: All automatic updates completed for MoMo payment success');
            } else {
                    // Booking status is already 'Confirmed' or another status - no update needed
                    console.log('bookingService: Payment successful but booking status is already:', booking.order_status, '- skipping status update');
                    // Rollback transaction since we didn't make any changes
                    await transaction.rollback();
                }
            } else {
                // Payment resultCode is not 0 (not successful)
                console.log('bookingService: Payment resultCode is not 0 (success). resultCode:', resultCode);
                // Rollback transaction since payment failed
                await transaction.rollback();
            }

            // Reload booking one more time to ensure we have the latest status
            await booking.reload({
                attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status']
            });
            const finalStatus = booking.order_status;
            
            console.log('bookingService: Payment callback processed successfully, final status:', finalStatus);

            resolve({
                errCode: 0,
                message: 'Payment callback processed successfully',
                booking: {
                    id: booking.id,
                    orderStatus: finalStatus,
                    resultCode: resultCode,
                    message: message
                }
            });
        } catch (e) {
            console.error('❌ bookingService: Error handling payment callback:', e);
            console.error('   Error stack:', e.stack);
            try {
                await transaction.rollback();
                console.log('✅ Transaction rolled back due to error');
            } catch (rollbackError) {
                console.error('❌ Error rolling back transaction:', rollbackError);
            }
            reject(e);
        }
    });
};

// Get active promotions
// Directly confirm a booking (bypass payment gateway)
let confirmBookingDirectly = async (bookingId, userId) => {
    return new Promise(async (resolve, reject) => {
        const transaction = await db.sequelize.transaction();
        try {
            console.log('bookingService: Directly confirming booking:', bookingId, 'for user:', userId);

            // Find booking
            const booking = await db.ShopOrder.findOne({
                where: { 
                    id: bookingId,
                    user_id: userId
                },
                transaction,
                attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status'],
                include: [
                    {
                        model: db.OrderLine,
                        include: [
                            {
                                model: db.ProductItem,
                                include: [
                                    {
                                        model: db.Product,
                                        include: [
                                            {
                                                model: db.ProductCategory
                                            },
                                            {
                                                model: db.ProductCountry
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!booking) {
                await transaction.rollback();
                resolve({
                    errCode: 1,
                    message: 'Booking not found'
                });
                return;
            }

            if (booking.order_status !== 'Pending') {
                await transaction.rollback();
                resolve({
                    errCode: 2,
                    message: `Booking is already ${booking.order_status}. Cannot confirm.`
                });
                return;
            }

            // Check payment window
            if (isPaymentWindowExpired(booking.order_date)) {
                await transaction.rollback();
                await cancelBooking(bookingId, userId);
                resolve({
                    errCode: 13,
                    message: 'Payment window expired (8 hours). Booking has been cancelled.'
                });
                return;
            }

            console.log('=== DIRECT CONFIRMATION - UPDATING STATUS ===');
            console.log('bookingService: Directly confirming booking from Pending to Confirmed...');
            console.log('   Booking ID:', booking.id);
            console.log('   Current status:', booking.order_status);

            // Ensure the 'Confirmed' status exists in order_status table with id=2
            // Note: Cannot update status if shop_order records reference it (FK constraint)
            // Strategy: Check if id=2 with 'Confirmed' exists, if not create it (don't try to update existing)
            console.log('bookingService: Ensuring "Confirmed" status with id=2 exists...');
            
            let confirmedStatus = await db.OrderStatus.findOne({
                where: { 
                    id: 2,
                    status: 'Confirmed'
                },
                transaction
            });
            
            if (!confirmedStatus) {
                // Check if id=2 exists with different status
                const id2Status = await db.OrderStatus.findOne({
                    where: { id: 2 },
                    transaction
                });
                
                if (id2Status) {
                    // id=2 exists but with wrong status
                    // Check if any shop_order records reference this status
                    const [referencingOrders] = await db.sequelize.query(
                        `SELECT COUNT(*) as count FROM shop_order WHERE order_status = :status`,
                        {
                            replacements: { status: id2Status.status },
                            type: db.sequelize.QueryTypes.SELECT,
                            transaction
                        }
                    );
                    
                    if (referencingOrders && referencingOrders.count > 0) {
                        console.log(`⚠️ bookingService: id=2 exists with status="${id2Status.status}" and ${referencingOrders.count} orders reference it. Cannot update due to FK constraint.`);
                        console.log('   Will use existing id=2 regardless of status name.');
                        // Use the existing id=2 even if status name is different
                        // The important thing is that order_line.order_status_id = 2
                        confirmedStatus = id2Status;
                    } else {
                        // No orders reference it, safe to update
                        console.log(`bookingService: id=2 exists with status="${id2Status.status}" but no orders reference it. Updating to "Confirmed"...`);
                        try {
                            await id2Status.update({ status: 'Confirmed' }, { transaction });
                            confirmedStatus = await db.OrderStatus.findOne({
                                where: { id: 2, status: 'Confirmed' },
                                transaction
                            });
                            console.log('✅ bookingService: Updated id=2 to status="Confirmed"');
                        } catch (updateError) {
                            console.error('❌ bookingService: Error updating id=2 status:', updateError.message);
                            // If update fails, use existing id=2 anyway
                            confirmedStatus = id2Status;
                            console.log('⚠️ bookingService: Using existing id=2 with status="' + id2Status.status + '"');
                        }
                    }
                } else {
                    // id=2 doesn't exist - create it
                    console.log('bookingService: id=2 does not exist, creating with status="Confirmed"...');
                    try {
                        confirmedStatus = await db.OrderStatus.create({
                            id: 2,
                            status: 'Confirmed'
                        }, { transaction });
                        console.log('✅ bookingService: Created id=2 with status="Confirmed"');
                    } catch (createError) {
                        console.error('❌ bookingService: Error creating id=2:', createError.message);
                        // If creation failed, try SQL
                        try {
                            await db.sequelize.query(
                                `INSERT INTO order_status (id, status) VALUES (2, 'Confirmed')`,
                                { transaction }
                            );
                            confirmedStatus = await db.OrderStatus.findOne({
                                where: { id: 2, status: 'Confirmed' },
                                transaction
                            });
                            console.log('✅ bookingService: Created id=2 via SQL');
                        } catch (sqlError) {
                            console.error('❌ bookingService: SQL creation also failed:', sqlError.message);
                            // Check if it was created by another transaction
                            confirmedStatus = await db.OrderStatus.findOne({
                                where: { id: 2 },
                                transaction
                            });
                            if (!confirmedStatus) {
                                throw new Error(`Failed to create or find id=2: ${sqlError.message}`);
                            }
                        }
                    }
                }
            } else {
                console.log(`✅ bookingService: id=2 with status="Confirmed" already exists`);
            }
            
            // Final verification - must have id=2 (status name is less critical due to FK constraints)
            if (!confirmedStatus || confirmedStatus.id !== 2) {
                const currentId = confirmedStatus?.id || 'null';
                const currentStatus = confirmedStatus?.status || 'null';
                throw new Error(`Failed to ensure id=2 exists. Got id=${currentId}, status=${currentStatus}`);
            }
            
            console.log(`✅ bookingService: Verified id=2 exists (status="${confirmedStatus.status}")`);

            const confirmedStatusId = confirmedStatus.id;
            const confirmedStatusName = confirmedStatus.status; // Use actual status name (may not be 'Confirmed' due to FK constraints)
            console.log(`✅ bookingService: Using status id=${confirmedStatusId}, name="${confirmedStatusName}" for updates`);

            // Update booking status to the actual status name (must match order_status.status due to FK)
            await booking.update({
                order_status: confirmedStatusName
            }, { transaction });
            console.log(`✅ shop_order.order_status updated to "${confirmedStatusName}"`);

            // Also update directly via SQL
            await db.sequelize.query(
                `UPDATE shop_order SET order_status = :statusName WHERE id = :bookingId`,
                {
                    replacements: { statusName: confirmedStatusName, bookingId: booking.id },
                    type: db.sequelize.QueryTypes.UPDATE,
                    transaction
                }
            );
            console.log(`✅ Direct SQL update executed for shop_order.order_status = "${confirmedStatusName}"`);

            // Update order_status_id in order_line to 2 (Confirmed) within transaction
            const orderLines = await db.OrderLine.findAll({
                where: { order_id: booking.id },
                transaction
            });

            console.log(`📋 Found ${orderLines.length} order line(s) to update`);

            for (const orderLine of orderLines) {
                const oldStatusId = orderLine.order_status_id;
                await orderLine.update({
                    order_status_id: confirmedStatusId
                }, { transaction });
                console.log(`   ✅ Updated order_line ID ${orderLine.id}: order_status_id ${oldStatusId} → ${confirmedStatusId}`);
            }

            // Also update directly via SQL
            await db.sequelize.query(
                `UPDATE order_line SET order_status_id = :statusId WHERE order_id = :bookingId`,
                {
                    replacements: { statusId: confirmedStatusId, bookingId: booking.id },
                    type: db.sequelize.QueryTypes.UPDATE,
                    transaction
                }
            );
            console.log(`✅ Direct SQL update executed for order_line.order_status_id = ${confirmedStatusId}`);

            // Commit the transaction
            await transaction.commit();
            console.log('✅ Transaction committed successfully');

            // Reload booking
            await booking.reload({
                attributes: ['id', 'user_id', 'order_date', 'payment_method_id', 'order_total', 'order_status']
            });

            // Verify the update
            const [verifyBooking] = await db.sequelize.query(
                `SELECT id, order_status FROM shop_order WHERE id = :bookingId`,
                { 
                    replacements: { bookingId: booking.id },
                    type: db.sequelize.QueryTypes.SELECT
                }
            );

            // Get the status name we're using (may not be 'Confirmed' due to FK constraints)
            const statusNameToUse = confirmedStatus.status;
            if (!verifyBooking || verifyBooking.order_status !== statusNameToUse) {
                throw new Error(`Failed to verify booking status update. Expected '${statusNameToUse}', got '${verifyBooking?.order_status || 'null'}'`);
            }

            console.log('✅ VERIFIED: Booking status successfully updated to Confirmed');

            // Reload booking with all necessary includes for tourism_data update
            await booking.reload({
                include: [
                    {
                        model: db.OrderLine,
                        include: [
                            {
                                model: db.ProductItem,
                                include: [
                                    {
                                        model: db.Product,
                                        include: [
                                            {
                                                model: db.ProductCategory
                                            },
                                            {
                                                model: db.ProductCountry
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            // Update all related data automatically
            try {
                await updateProductMetricsRevenue(booking);
                console.log('bookingService: Product metrics updated');
            } catch (error) {
                console.error('bookingService: Error updating product metrics:', error);
            }

            try {
                await updateTourismData(booking);
                console.log('bookingService: Tourism data updated');
            } catch (error) {
                console.error('bookingService: Error updating tourism data:', error);
            }

            try {
                await updateUserStatsOnPaymentSuccess(booking);
                console.log('bookingService: User stats updated');
            } catch (error) {
                console.error('bookingService: Error updating user stats:', error);
            }

            console.log('bookingService: All automatic updates completed for direct confirmation');

            resolve({
                errCode: 0,
                message: 'Booking confirmed successfully',
                booking: {
                    id: booking.id,
                    orderStatus: 'Confirmed'
                }
            });
        } catch (e) {
            console.error('❌ bookingService: Error directly confirming booking:', e);
            console.error('   Error stack:', e.stack);
            try {
                await transaction.rollback();
                console.log('✅ Transaction rolled back due to error');
            } catch (rollbackError) {
                console.error('❌ Error rolling back transaction:', rollbackError);
            }
            reject(e);
        }
    });
};

let getActivePromotions = async () => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('bookingService: Getting active promotions');
            
            const now = new Date();
            // Set time to start of day for accurate date comparison
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // Get promotions that are currently active (between start_date and end_date)
            const promotions = await db.Promotion.findAll({
                where: {
                    start_date: {
                        [db.Sequelize.Op.lte]: now
                    },
                    end_date: {
                        [db.Sequelize.Op.gte]: today
                    }
                },
                order: [['discount_rate', 'DESC']] // Sort by discount rate descending
            });
            
            console.log('bookingService: Found active promotions:', promotions.length);
            
            resolve({
                errCode: 0,
                message: 'Active promotions retrieved successfully',
                promotions: promotions.map(promo => ({
                    id: promo.id,
                    name: promo.name,
                    discount_rate: parseFloat(promo.discount_rate) || 0,
                    start_date: promo.start_date,
                    end_date: promo.end_date
                }))
            });
        } catch (error) {
            console.error('bookingService: Error getting active promotions:', error);
            console.error('bookingService: Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
            reject(error);
        }
    });
};

export default {
    createBooking,
    getUserBookings,
    getBookingById,
    cancelBooking,
    getProducts,
    searchProducts,
    updatePaymentStatus,
    handlePaymentCallback,
    confirmBookingDirectly,
    getActivePromotions
};










