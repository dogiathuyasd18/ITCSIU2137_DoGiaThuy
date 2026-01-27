import userService from '../services/userService.js';
import db from '../models/index.js';
let handleLogin = async (req, res) => {
    const {email, password} =req.body;

    if (!email || !password) {
        return res.status(400).json({
            errCode: 1,
            message: 'Missing input parameters!'
        });
    }

    try {
        let userData = await userService.handleUserLogin(email, password);

        if (userData.errCode === 0) {
            // Return JSON response for frontend handling
            return res.status(200).json({
                errCode: 0,
                message: 'Login successful',
                user: userData.user,
                roleId: userData.roleId,
                access_token: userData.access_token
            });
        } else {
            // Send error details back as JSON for frontend handling
            return res.status(400).json({
                errCode: userData.errCode,
                message: userData.errMessage
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal Server Error'
        });
    } 
}


let handleRegister = async (req, res) => {
    const {email, password, firstName, lastName, phoneNumber, address, gender, roleId} = req.body;

    if (!email || !password) {
        return res.status(400).json({
            errCode: 1,
            message: 'Missing input parameters!'
        });
    }

    try {
        const userData = {
            email,
            password,
            firstName,
            lastName,
            phoneNumber,
            address,
            gender: gender === true || gender === 'true' || gender === 1,
            roleId: roleId || 1 
        };
        let registerData = await userService.createNewUser(userData);

        if (registerData.errCode === 0) {
            return res.status(200).json({
                errCode: 0,
                message: 'Registration successful',
                user: registerData.user
            });
        } else {
            return res.status(400).json({
                errCode: registerData.errCode,
                message: registerData.errMessage
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            errCode: 500,
            message: 'Internal Server Error'
        });
    }
}

let handleMoMoPayment = async(req,res) =>{
    try {

        let amount = req.body.amount || '40000';
        let bookingId = req.body.bookingId || null;
        console.log("Payment controller received amount:", amount, "bookingId:", bookingId);
        console.log("Request body:", req.body);
        console.log("Amount type:", typeof amount);
        console.log("Amount value:", amount);
        
        // Convert amount to proper format
        if (typeof amount === 'string') {
            amount = amount.trim();
        }
        
        // Convert to number for validation
        const numericAmount = parseFloat(amount);
        console.log("Numeric amount:", numericAmount);
        
        // Ensure amount is valid
        if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
            console.log("Invalid amount detected:", { amount, numericAmount });
            return res.status(400).json({
                errCode: 400,
                message: "Invalid amount provided. Amount must be a positive number."
            });
        }
        
        // Use the original string amount for MoMo API, pass bookingId for callback
        const response = await userService.momoPayment(String(amount), bookingId);
        console.log("Payment service response:", response);
        
        return res.status(200).json(response);
    } catch (error) {
        console.error("Payment controller error:", error);
        return res.status(500).json({
            errCode: 500,
            message: error.message || "Internal Server Error"
        })
    }
}

// Get products with schedules that user can review (Completed orders only)
let getReviewableProducts = async (req, res) => {
    try {
        const user_id = req.currentUser?.id;

        if (!user_id) {
            return res.status(401).json({
                errCode: 1,
                errMessage: "User authentication required",
            });
        }

        // Get all orders with Completed status for this user
        const orders = await db.ShopOrder.findAll({
            where: {
                user_id: user_id,
                order_status: {
                    [db.Sequelize.Op.in]: ['Completed']
                }
            },
            include: [
                {
                    model: db.OrderLine,
                    where: {
                        schedule_id: {
                            [db.Sequelize.Op.ne]: null // Only get order lines with schedule_id
                        }
                    },
                    required: true,
                    include: [
                        {
                            model: db.ProductItem,
                            required: true,
                            include: [
                                {
                                    model: db.Product,
                                    attributes: ['id', 'name'],
                                    required: true
                                }
                            ]
                        },
                        {
                            model: db.ProductSchedule,
                            attributes: ['id', 'travel_date', 'end_date'],
                            required: true
                        }
                    ]
                }
            ]
        });

        // Get all products that the user has already reviewed
        const existingReviews = await db.UserReview.findAll({
            where: { user_id: user_id },
            attributes: ['product_id']
        });
        
        const reviewedProductIds = existingReviews
            .map(review => review.product_id)
            .filter(id => id !== null);

        // Format the data to show product - date/time options (excluding already reviewed products)
        const reviewableItems = [];
        orders.forEach(order => {
            order.OrderLines.forEach(orderLine => {
                if (orderLine.schedule_id && orderLine.ProductItem && orderLine.ProductItem.Product) {
                    const schedule = orderLine.ProductSchedule;
                    const product = orderLine.ProductItem.Product;
                    
                    // Skip if user has already reviewed this product
                    if (reviewedProductIds.includes(product.id)) {
                        return;
                    }
                    
                    if (schedule) {
                        const travelDate = new Date(schedule.travel_date);
                        const endDate = schedule.end_date ? new Date(schedule.end_date) : null;
                        
                        const dateStr = travelDate.toISOString().split('T')[0];
                        const timeStr = travelDate.toTimeString().split(' ')[0].substring(0, 5);
                        const endTimeStr = endDate ? endDate.toTimeString().split(' ')[0].substring(0, 5) : null;
                        
                        const displayText = endTimeStr 
                            ? `${product.name} - ${dateStr} ${timeStr} to ${endTimeStr}`
                            : `${product.name} - ${dateStr} ${timeStr}`;
                        
                        reviewableItems.push({
                            shop_order_id: order.id,
                            schedule_id: schedule.id,
                            product_id: product.id,
                            product_name: product.name,
                            travel_date: schedule.travel_date,
                            end_date: schedule.end_date,
                            display_text: displayText,
                            order_id: order.id, // Keep for backward compatibility
                            order_status: order.order_status
                        });
                    }
                }
            });
        });

        return res.status(200).json({
            errCode: 0,
            errMessage: "OK",
            data: reviewableItems
        });

    } catch (error) {
        console.error("Error in getReviewableProducts:", error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Server error: ${error.message}`,
        });
    }
};

let handleCreateSurvey = async (req, res) => {
    try {
        // Support both shop_order_id (new) and schedule_id (legacy) for backward compatibility
        const { rating, comment, shop_order_id, schedule_id } = req.body;
        const user_id = req.currentUser?.id;

        // Validate required fields
        if (!user_id) {
            return res.status(401).json({
                errCode: 1,
                errMessage: "User authentication required",
            });
        }

        if (!rating) {
            return res.status(400).json({
                errCode: 1,
                errMessage: "Rating is required",
            });
        }

        // Validate rating range
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                errCode: 1,
                errMessage: "Rating must be between 1 and 5",
            });
        }

        // Validate shop_order_id if provided (preferred method)
        // Also support schedule_id for backward compatibility
        if (shop_order_id) {
            // Check if user has this order with Completed status
            const userOrder = await db.ShopOrder.findOne({
                where: { 
                    id: shop_order_id,
                    user_id: user_id,
                    order_status: {
                        [db.Sequelize.Op.in]: ['Completed']
                    }
                },
                include: [
                    {
                        model: db.OrderLine,
                        required: true,
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
                    }
                ]
            });

            if (!userOrder) {
                return res.status(403).json({
                    errCode: 1,
                    errMessage: "You can only submit a survey for orders you have placed with Completed status",
                });
            }

            // Get product_id from the first order line (or handle multiple products if needed)
            const orderLine = userOrder.OrderLines[0];
            const product_id = orderLine?.ProductItem?.product_id || null;

            if (!product_id) {
                return res.status(400).json({
                    errCode: 1,
                    errMessage: "Unable to identify product from this order",
                });
            }

            // Check if user has already reviewed this product
            const existingReview = await db.UserReview.findOne({
                where: {
                    user_id: user_id,
                    product_id: product_id
                }
            });

            if (existingReview) {
                return res.status(403).json({
                    errCode: 1,
                    errMessage: "You have already submitted feedback for this product. You can only give feedback once per product.",
                });
            }

            // Save to database (user_review table) with product_id
            const newSurvey = await db.UserReview.create({
                user_id,
                product_id: product_id,
                rating,
                comment: comment || null
            });

            return res.status(200).json({
                errCode: 0,
                errMessage: "Survey submitted successfully",
                data: newSurvey,
            });
        } else if (schedule_id) {
            // Backward compatibility: support schedule_id (legacy method)
            // Check if user has an order with this schedule_id and Completed status
            const hasBooked = await db.ShopOrder.findOne({
                where: { 
                    user_id: user_id,
                    order_status: {
                        [db.Sequelize.Op.in]: ['Completed']
                    }
                },
                include: [
                    {
                        model: db.OrderLine,
                        where: { schedule_id: schedule_id },
                        required: true,
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
                    }
                ]
            });

            if (!hasBooked) {
                return res.status(403).json({
                    errCode: 1,
                    errMessage: "You can only submit a survey for products you have ordered with Completed status",
                });
            }

            // Get product_id from the order line
            const orderLine = hasBooked.OrderLines[0];
            const product_id = orderLine?.ProductItem?.product_id || null;

            // Check if user has already reviewed this product
            const existingReview = await db.UserReview.findOne({
                where: {
                    user_id: user_id,
                    product_id: product_id
                }
            });

            if (existingReview) {
                return res.status(403).json({
                    errCode: 1,
                    errMessage: "You have already submitted feedback for this product. You can only give feedback once per product.",
                });
            }

            // Save to database (user_review table) with product_id
            const newSurvey = await db.UserReview.create({
                user_id,
                product_id: product_id,
                rating,
                comment: comment || null
            });

            return res.status(200).json({
                errCode: 0,
                errMessage: "Survey submitted successfully",
                data: newSurvey,
            });
        } else {
            // If no shop_order_id or schedule_id provided, save without product_id (general feedback)
            const newSurvey = await db.UserReview.create({
                user_id,
                product_id: null,
                rating,
                comment: comment || null
            });

            return res.status(200).json({
                errCode: 0,
                errMessage: "Survey submitted successfully",
                data: newSurvey,
            });
        }


    } catch (error) {
        console.error("Error in handleCreateSurvey:", error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Server error: ${error.message}`,
        });
    }
};

export default {
    handleLogin: handleLogin,
    handleRegister: handleRegister,
    handleMoMoPayment: handleMoMoPayment,
    handleCreateSurvey: handleCreateSurvey,
    getReviewableProducts: getReviewableProducts
}