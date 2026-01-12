import { Server, Socket } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { RateLimiter } from '../utils/rateLimiter';
import { generateFileId, sanitizeFilename, validateFile } from '../utils/fileUtils';

interface User {
    userId: string;
    socketId: string;
    username?: string;
    email?: string;
}

let onlineUsers: User[] = [];

// Rate Limit: 10 uploads per minute per user
const uploadLimiter = new RateLimiter(10, 60 * 1000);

// Track active uploads for cleanup on disconnect: socketId -> Set<filePath>
const activeUploads = new Map<string, Set<string>>();

export const registerSocketHandlers = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('join', (userData: { userId: string; username: string; email: string }) => {
            const { userId, username, email } = userData;
            // Remove existing socket for this user if any
            onlineUsers = onlineUsers.filter((user) => user.userId !== userId);
            onlineUsers.push({ userId, socketId: socket.id, username, email });

            console.log(`User registered: ${username} (${userId})`);
            io.emit('online-users', onlineUsers);
        });

        // --- File Upload Handling ---

        socket.on('upload-start', (data: { fileName: string; size: number; recipientId?: string }) => {
            const { fileName, size, recipientId } = data;
            const userId = onlineUsers.find(u => u.socketId === socket.id)?.userId || socket.id;

            // 1. Empty File Check
            if (size <= 0) {
                socket.emit('upload-error', { message: 'File is empty.' });
                return;
            }

            // 2. Recipient Verification (for private shares)
            if (recipientId) {
                const recipientExists = onlineUsers.some(u => u.userId === recipientId);
                if (!recipientExists) {
                    socket.emit('upload-error', { message: 'Recipient is offline or does not exist.' });
                    return;
                }
            }

            // 3. Rate Limiting
            if (!uploadLimiter.checkLimit(userId)) {
                socket.emit('upload-error', { message: 'Rate limit exceeded. Please wait.' });
                return;
            }

            // 4. Validation
            const validation = validateFile(fileName, size);
            if (!validation.valid) {
                socket.emit('upload-error', { message: validation.error });
                return;
            }

            // 5. Sanitization & ID Generation
            const safeFileName = sanitizeFilename(fileName);
            const fileId = generateFileId();
            
            // Store mapped filename logic (ID-SafeName)
            const storageName = `${fileId}-${safeFileName}`;
            const filePath = path.join(__dirname, '../../uploads', storageName);

            // Track active upload
            if (!activeUploads.has(socket.id)) {
                activeUploads.set(socket.id, new Set());
            }
            activeUploads.get(socket.id)?.add(filePath);

            // Create an empty file
            fs.writeFile(filePath, '', (err) => {
                if (err) {
                    console.error('Error creating file:', err);
                    activeUploads.get(socket.id)?.delete(filePath); // Cleanup on error
                    socket.emit('upload-error', { fileId, message: 'Failed to start upload' });
                } else {
                    // Send back the generated ID and the SAFE filename to use for future chunks
                    socket.emit('upload-ack', { fileId, fileName: safeFileName, status: 'ready' });
                }
            });
        });

        socket.on('upload-chunk', (data: { fileId: string; fileName: string; chunk: Buffer; offset: number }) => {
            const { fileId, fileName, chunk } = data;
            const filePath = path.join(__dirname, '../../uploads', `${fileId}-${fileName}`);

            fs.appendFile(filePath, chunk, (err) => {
                if (err) {
                    console.error('Error appending chunk:', err);
                    socket.emit('upload-error', { fileId, message: 'Failed to write chunk' });
                }
            });
        });

        socket.on('upload-end', (data: { fileId: string; fileName: string; isPrivate: boolean; recipientId?: string; senderId: string, senderName: string }) => {
            const { fileId, fileName, isPrivate, recipientId, senderId, senderName } = data;
            const filePath = path.join(__dirname, '../../uploads', `${fileId}-${fileName}`);
            
            // Remove from active uploads (successfully completed)
            if (activeUploads.has(socket.id)) {
                activeUploads.get(socket.id)?.delete(filePath);
            }

            const downloadUrl = `/uploads/${fileId}-${fileName}`;

            const fileData = {
                fileId,
                fileName,
                downloadUrl,
                senderId,
                senderName,
                timestamp: new Date().toISOString(),
                isPrivate
            };

            if (isPrivate && recipientId) {
                const recipient = onlineUsers.find(u => u.userId === recipientId);
                if (recipient) {
                    io.to(recipient.socketId).emit('file-shared', fileData);
                    socket.emit('file-sent', { ...fileData, recipientName: recipient.username });
                }
            } else {
                io.emit('file-shared', fileData);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            
            // Cleanup partial uploads
            if (activeUploads.has(socket.id)) {
                const userUploads = activeUploads.get(socket.id);
                if (userUploads) {
                    userUploads.forEach((filePath) => {
                        console.log(`Cleaning up partial upload: ${filePath}`);
                        fs.unlink(filePath, (err) => {
                            if (err) console.error(`Failed to delete partial file ${filePath}:`, err);
                        });
                    });
                }
                activeUploads.delete(socket.id);
            }

            onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
            io.emit('online-users', onlineUsers);
        });
    });
};
