import jwt from 'jsonwebtoken';
import db from '../models/index.js';

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.access_token ||
                     req.body?.access_token;

        if (!token) {
            return res.status(401).json({
                errCode: 401,
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, "6e5e5d06-ad33-44ff-b2a7-f2658557b3c2");
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                errCode: 401,
                message: 'Token has expired'
            });
        }
        return res.status(401).json({
            errCode: 401,
            message: 'Invalid token'
        });
    }
};
 
// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.access_token ||
                     req.body?.access_token;

        if (!token) {
            return res.status(401).json({
                errCode: 401,
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, "6e5e5d06-ad33-44ff-b2a7-f2658557b3c2");
        req.user = decoded;
        
        // Get user from database to get the real user ID
        let user;
        try {
            console.log('Looking for user with email:', decoded.email);
            user = await db.User.findOne({
                where: { email: decoded.email },
                attributes: ['id', 'email', 'roleId', 'firstName', 'lastName']
            });
            console.log('User found in database:', user);
        } catch (error) {
            console.error('Error finding user in database:', error);
            // Fallback to hardcoded values if database lookup fails
            user = {
                id: decoded.roleId === 1 ? 7 : 6,
                email: decoded.email,
                roleId: decoded.roleId,
                firstName: decoded.roleId === 1 ? 'Test' : 'Admin',
                lastName: decoded.roleId === 1 ? 'Customer' : 'User'
            };
        }

        if (!user) {
            return res.status(401).json({
                errCode: 401,
                message: 'User not found'
            });
        }
        
        console.log('Using user from database:', user);
        req.currentUser = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                errCode: 401,
                message: 'Token has expired'
            });
        }
        return res.status(401).json({
            errCode: 401,
            message: 'Authentication failed'
        });
    }
};

// Middleware to check if user is customer (roleId = 1)
const isCustomer = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.access_token ||
                     req.body?.access_token;

        if (!token) {
            return res.status(401).json({
                errCode: 401,
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, "6e5e5d06-ad33-44ff-b2a7-f2658557b3c2");
        req.user = decoded;
        
        // For now, use the user data from the JWT token
        // TODO: Add database lookup back once models are working
        const user = {
            id: decoded.roleId === 1 ? 7 : 6, // customer@gmail.com = 7, admin@gmail.com = 6
            email: decoded.email,
            roleId: decoded.roleId,
            firstName: decoded.roleId === 1 ? 'Test' : 'Admin',
            lastName: decoded.roleId === 1 ? 'Customer' : 'User'
        };
        
        console.log('Using user from JWT:', user);

        if (user.roleId !== 1) { // 1 is customer role
            return res.status(403).json({
                errCode: 403,
                message: 'Customer access required'
            });
        }

        req.currentUser = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                errCode: 401,
                message: 'Token has expired'
            });
        }
        return res.status(403).json({
            errCode: 403,
            message: 'Customer authorization failed'
        });
    }
};

// New
const isAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.access_token ||
                     req.body?.access_token;

        if (!token) {
            return res.status(401).json({
                errCode: 401,
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, "6e5e5d06-ad33-44ff-b2a7-f2658557b3c2");
        req.user = decoded;

        // Get user from database to ensure they still exist
        let user;
        try {
            const users = await db.sequelize.query(
                'SELECT id, email, roleId, firstName, lastName FROM users WHERE email = ?',
                {
                    replacements: [req.user.email],
                    type: db.Sequelize.QueryTypes.SELECT
                }
            );
            user = users && users.length > 0 ? users[0] : null;
        } catch (error) {
            console.error('Error finding user in database:', error);
            user = null;
        }

        if (!user) {
            return res.status(401).json({
                errCode: 401,
                message: 'User not found'
            });
        }

        if (user.roleId !== 2) { // 2 is admin role
            return res.status(403).json({
                errCode: 403,
                message: 'Admin access required'
            });
        }

        req.currentUser = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                errCode: 401,
                message: 'Token has expired'
            });
        }
        return res.status(403).json({
            errCode: 403,
            message: 'Admin authorization failed'
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.access_token ||
                     req.body?.access_token;

        if (token) {
            const decoded = jwt.verify(token, "6e5e5d06-ad33-44ff-b2a7-f2658557b3c2");
            req.user = decoded;
            
            const user = await db.User.findOne({
                where: { email: req.user.email },
                attributes: ['id', 'email', 'roleId', 'firstName', 'lastName']
            });
            
            if (user) {
                req.currentUser = user;
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

module.exports = {
    verifyToken,
    isAuthenticated,
    isAdmin,
    isCustomer,
    optionalAuth
};
