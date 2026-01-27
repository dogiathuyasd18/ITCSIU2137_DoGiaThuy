import db from '../models/index.js';
import bcrypt from 'bcryptjs';
const jwt = require("jsonwebtoken");
const salt = bcrypt.genSaltSync(10);
import crypto from 'crypto';
import axios from 'axios';
require("dotenv").config

const handleUserLogin = (email, password, req, res) => {
    return new Promise(async (resolve, reject) => {
        try {
            let userData = {};
            let isExist = await checkUserEmail(email);
            if (isExist) {
                //user already exist
                let user = await db.User.findOne({
                    attributes: ['id', 'email', 'roleId', 'password', 'firstName', 'lastName'],
                    where: { email: email },
                    raw: true,
                });
                if (user) {
                    let check = await bcrypt.compare(password, user.password);
                    if (check) {
                        delete user.password;
                        userData.user = user;
                        
                        const payload = {
                            email: user.email,
                            roleId: user.roleId
                        }
                        userData = {
                            errCode: 0,
                            errMessage: 'OK',
                            user: user,
                            access_token: jwt.sign(payload, "6e5e5d06-ad33-44ff-b2a7-f2658557b3c2", { expiresIn: "1h" })
                        };

                    }
                    else {
                        userData.errCode = 3;
                        userData.errMessage = 'Wrong password';

                    }
                } else {
                    userData.errCode = 2;
                    userData.errMessage = `User not found`;

                }
            } else {
                //return error
                userData.errCode = 1;
                userData.errMessage = `Your's Email isn't exist in our system, plz try other email`

            }
            resolve(userData)
        } catch (e) {
            reject(e);
        }
    })
}

let checkUserEmail = (userEmail) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('userService: Checking if email exists:', userEmail);
            
            let user = await db.User.findOne({
                where: { email: userEmail }
            });
            
            console.log('userService: Email check result:', user ? 'User found' : 'User not found');
            
            if (user) {
                resolve(true);
            } else {
                resolve(false);
            }

        } catch (e) {
            console.error('userService: Error checking email:', e);
            reject(e);
        }
    });
};

let createNewUser = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            let hashPassWordFromBcrypt = await hashUserPassword(data.password);
            
            const newUser = await db.User.create({
                email: data.email,
                password: hashPassWordFromBcrypt,
                firstName: data.firstName,
                lastName: data.lastName,
                address: data.address,
                phone_number: data.phoneNumber,
                gender: data.gender === '1' ? true : false,
                roleId: data.roleId === 'R1' ? 1 : (data.roleId === 'R2' ? 2 : 1),
            });
            
            // Return success response in the format expected by controller
            resolve({
                errCode: 0,
                errMessage: 'User created successfully',
                user: {
                    email: newUser.email,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    roleId: newUser.roleId
                }
            });
        } catch (e) {
            console.error('userService: Error creating user:', e);
            reject(e);
        }
    });
};

let hashUserPassword = (password) => {
    return new Promise(async (resolve, reject) => {
        try {
            let hashPassWord = await bcrypt.hashSync(password, salt);

            resolve(hashPassWord);
        } catch (e) {
            reject(e);
        }

    })
}

let momoPayment = async (amount = '40000', bookingId = null) => {
    // MoMo test credentials (these might be expired)
    const accessKey = 'F8BBA842ECF85';
    const secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
    const partnerCode = 'MOMO';
    
    // MoMo redirects the user to redirectUrl after payment (GET with resultCode, extraData, etc.).
    // Use backend return URL so we can update booking status, then redirect user to frontend.
    const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/api/payment/momo/return`;
    const ipnUrl = `${baseUrl}/api/payment/momo/callback`;
    
    const requestType = "payWithMethod";
    const orderInfo = "Tourism Booking Payment";
    const orderId = partnerCode + new Date().getTime();
    const requestId = orderId;
    
    // Store booking ID in extraData so callback can find the booking.
    // MoMo expects a base64 string (often empty string is fine too).
    const extraData = bookingId
        ? Buffer.from(JSON.stringify({ bookingId })).toString('base64')
        : '';
    const orderGroupId = '';
    const autoCapture = true;
    const lang = 'vi';

    // Log credentials for debugging
    console.log("Using MoMo credentials:");
    console.log("- Access Key:", accessKey);
    console.log("- Partner Code:", partnerCode);
    console.log("- Redirect URL:", redirectUrl);
    console.log("- IPN URL:", ipnUrl);

    // Ensure amount is properly formatted for MoMo
    const amountStr = String(amount).trim();
    const amountInt = parseInt(amountStr);
    console.log("Processing amount:", amountStr, "as integer:", amountInt);
    
    // Validate amount
    if (isNaN(amountInt) || amountInt <= 0) {
        throw new Error(`Invalid amount: ${amountStr}`);
    }

    // Create raw signature string (correct order for MoMo API)
    const rawSignature = `accessKey=${accessKey}&amount=${amountStr}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    console.log("Raw signature string:", rawSignature);

    // Create HMAC SHA256 signature
    const signature = crypto.createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

    console.log("Generated signature:", signature);

    // Build request body with correct MoMo API format
    const requestBody = {
        partnerCode: partnerCode,
        partnerName: "Test",
        storeId: "MomoTestStore",
        requestId: requestId,
        amount: amountInt, // MoMo expects integer, not string
        orderId: orderId,
        orderInfo: orderInfo,
        redirectUrl: redirectUrl,
        ipnUrl: ipnUrl,
        lang: lang,
        requestType: requestType,
        autoCapture: autoCapture,
        extraData: extraData,
        orderGroupId: orderGroupId,
        signature: signature
    };

    const options = {
        method: "POST",
        url: "https://test-payment.momo.vn/v2/gateway/api/create",
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        data: requestBody,
        timeout: 15000 // 15 second timeout
    };

    try {
        console.log("Sending MoMo payment request with amount:", amountStr);
        console.log("Request body:", JSON.stringify(requestBody, null, 2));
        
        const result = await axios(options);
        console.log("MoMo API response status:", result.status);
        console.log("MoMo API response:", JSON.stringify(result.data, null, 2));
        
        return result.data;
    } catch (error) {
        console.error("MoMo payment error:", error.message);
        if (error.response) {
            console.error("MoMo error status:", error.response.status);
            console.error("MoMo error response:", JSON.stringify(error.response.data, null, 2));
            console.error("MoMo error headers:", error.response.headers);
        } else if (error.request) {
            console.error("MoMo request error:", error.request);
        }
        
        // Do NOT return a fake payUrl (it will appear "expired" to users).
        // Surface the real error so the frontend can display it.
        const momoMsg = error?.response?.data?.message || error?.response?.data?.errorCode || error.message;
        throw new Error(`MoMo create payment failed: ${momoMsg}`);
    }
};

export default {
    handleUserLogin: handleUserLogin,
    createNewUser: createNewUser,
    hashUserPassword: hashUserPassword,
    checkUserEmail: checkUserEmail,
    momoPayment: momoPayment
}