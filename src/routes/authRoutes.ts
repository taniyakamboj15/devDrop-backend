import express from 'express';
import {
    signup,
    login,
    logout,
    getUserProfile,
    updateUserProfile,
    forgotPassword,
    verifyOtp,
    resetPassword,
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { validateSignup, validateLogin } from '../middleware/validationMiddleware';
import { authLimiter, apiLimiter } from '../middleware/rateLimitMiddleware';

const router = express.Router();

router.post('/signup', authLimiter, validateSignup, signup);
router.post('/login', authLimiter, validateLogin, login);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/reset-password', authLimiter, resetPassword);
router.route('/profile')
    .get(protect, apiLimiter, getUserProfile)
    .put(protect, apiLimiter, updateUserProfile);

export default router;
