import { Request, Response, NextFunction } from 'express';
import User from '../models/userModel';
import generateToken from '../utils/generateToken';
import sendEmail from '../utils/email';
import crypto from 'crypto';


const signup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            res.status(400);
            throw new Error('User already exists');
        }

        const user = await User.create({
            name,
            email,
            password,
        });

        if (user) {
            generateToken(res, user._id);
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
            });
        } else {
            res.status(400);
            throw new Error('Invalid user data');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        // @ts-ignore
        if (user && (await user.matchPassword(password))) {
            generateToken(res, user._id);
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
            });
        } else {
            res.status(401);
            throw new Error('Invalid email or password');
        }
    } catch (error) {
        next(error);
    }
};


const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.cookie('jwt', '', {
            httpOnly: true,
            expires: new Date(0),
        });
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};


const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(req.user!._id);

        if (user) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        next(error);
    }
};


const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(req.user!._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            if (req.body.password) {
                if (req.body.oldPassword) {
                    // @ts-ignore
                    if (await user.matchPassword(req.body.oldPassword)) {
                        user.password = req.body.password;
                    } else {
                        res.status(401);
                        throw new Error('Invalid old password');
                    }
                } else {
                    res.status(400);
                    throw new Error('Old password is required to set a new password');
                }
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};



const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await user.save();

        const message = `Your password reset OTP is ${otp}. It is valid for 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset OTP',
                message,
            });

            res.status(200).json({ message: 'OTP sent to email' });
        } catch (error) {
            user.otp = undefined;
            // @ts-ignore
            user.otpExpires = undefined;
            await user.save();
            res.status(500);
            throw new Error('Email could not be sent');
        }
    } catch (error) {
        next(error);
    }
};


const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({
            email,
            otp,
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            res.status(400);
            throw new Error('Invalid or expired OTP');
        }

        res.status(200).json({ message: 'OTP Verified' });
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, otp, password } = req.body;

        const user = await User.findOne({
            email,
            otp,
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            res.status(400);
            throw new Error('Invalid or expired OTP');
        }

        user.password = password;
        user.otp = undefined;
        // @ts-ignore
        user.otpExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Password Reset Successfully' });
    } catch (error) {
        next(error);
    }
};
const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { query } = req.query;

        if (!query) {
            res.status(400);
            throw new Error('Search query is required');
        }

        const users = await User.find({
            $or: [
                { name: { $regex: query as string, $options: 'i' } },
                { email: { $regex: query as string, $options: 'i' } }
            ],
            _id: { $ne: req.user!._id } // Exclude current user
        }).select('_id name email');

        res.json(users);
    } catch (error) {
        next(error);
    }
};

export {
    signup,
    login,
    logout,
    getUserProfile,
    updateUserProfile,
    forgotPassword,
    verifyOtp,
    resetPassword,
    searchUsers,
};
