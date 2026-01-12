import { Request, Response, NextFunction } from 'express';

const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
// Password must be at least 8 characters, contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const validateSignup = (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please include all fields: name, email, password');
    }

    if (!emailRegex.test(email)) {
        res.status(400);
        throw new Error('Please enter a valid email address');
    }

    if (!passwordRegex.test(password)) {
        res.status(400);
        throw new Error(
            'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character'
        );
    }

    next();
};

const validateLogin = (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Please include all fields: email and password');
    }


    if (!emailRegex.test(email)) {
        res.status(400);
        throw new Error('Please enter a valid email address');
    }

    next();
};

export { validateSignup, validateLogin };
