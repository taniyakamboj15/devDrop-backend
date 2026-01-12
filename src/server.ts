import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import helmet from 'helmet';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import { notFound, errorHandler } from './middleware/errorMiddleware';
import { registerSocketHandlers } from './socket/socketHandler';
import { initCronJobs } from './services/cronJob';

dotenv.config();


// Initialize Cron Jobs
initCronJobs();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5000;

app.use(cors({
    origin: 'http://localhost:5173', // Frontend URL
    credentials: true,
}));

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } 
})); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Socket.io Setup
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
});

registerSocketHandlers(io);

app.use(notFound);
app.use(errorHandler);



connectDB().then(() => {
    httpServer.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}).catch((err: Error) => {
    console.error('Failed to connect to DB', err);
    process.exit(1);
});
