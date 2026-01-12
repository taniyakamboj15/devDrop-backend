interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

export class RateLimiter {
    private store: RateLimitStore = {};
    private limit: number;
    private windowMs: number;

    constructor(limit: number, windowMs: number) {
        this.limit = limit;
        this.windowMs = windowMs;
    }

    checkLimit(key: string): boolean {
        const now = Date.now();
        const record = this.store[key];

        if (!record || now > record.resetTime) {
            // New window or expired
            this.store[key] = {
                count: 1,
                resetTime: now + this.windowMs
            };
            return true;
        }

        if (record.count < this.limit) {
            record.count++;
            return true;
        }

        return false;
    }

    cleanup() {
        // Optional: Periodic cleanup of expired keys
        const now = Date.now();
        for (const key in this.store) {
            if (now > this.store[key].resetTime) {
                delete this.store[key];
            }
        }
    }
}
