import { Server, Socket } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { RateLimiter } from '../utils/rateLimiter';
import { generateFileId, sanitizeFilename, validateFile } from '../utils/fileUtils';
import mongoose from 'mongoose';
import FileTransfer from '../models/FileTransfer';
import UserModel from '../models/userModel';

interface User {
    userId: string;
    socketId: string;
    username?: string;
    email?: string;
}

let onlineUsers: User[] = [];

// Rate Limit: 10 uploads per minute per user
const uploadLimiter = new RateLimiter(10, 60 * 1000);


const activeUploads = new Map<string, Set<string>>();

export const registerSocketHandlers = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('join', async (userData: { userId: string; username: string; email: string }) => {
            const { userId, username, email } = userData;
            
        
            if (!onlineUsers.some(u => u.socketId === socket.id)) {
                 onlineUsers.push({ userId, socketId: socket.id, username, email });
            }

            socket.join(userId);

            console.log(`User registered: ${username} (${userId}) on socket ${socket.id}`);
            io.emit('online-users', [...new Map(onlineUsers.map(item => [item.userId, item])).values()]); // Unique users for UI list

            // Check for pending files
            try {

                console.log(`Checking pending files for user: ${userId}`);
                const pendingFiles = await FileTransfer.find({ 
                    recipientId: new mongoose.Types.ObjectId(userId), 
                    status: 'pending' 
                }).populate('senderId', 'name email');
                
                console.log(`Found pending files count: ${pendingFiles?.length}`);
                
                if (pendingFiles.length > 0) {
                    console.log(`Delivering ${pendingFiles.length} pending files to ${username}`);
                    
                    for (const file of pendingFiles) {
                        try {
                             const sender = file.senderId as any; // Populated
                             const fileData = {
                                fileId: file.fileId,
                                fileName: file.fileName,
                                downloadUrl: file.downloadUrl,
                                senderId: sender._id.toString(), 
                                senderName: sender.name || 'Unknown Sender',
                                timestamp: file.createdAt.toISOString(),
                                isPrivate: true,
                                isOffline: true // Flag to indicate offline delivery
                            };
                            
                            console.log(`Emitting file-shared for fileId: ${file.fileId}`);
                            socket.emit('file-shared', fileData);
                            
                            file.status = 'delivered';
                            await file.save();
                            console.log(`Marked file ${file.fileId} as delivered.`);

                            // Notify Sender if Online (Broadcast to their room)
                            const senderIdStr = sender._id.toString();
                            // We don't need to manually find the socket anymore, just emit to the room
                            io.to(senderIdStr).emit('file-delivered', {
                                fileId: file.fileId,
                                recipientName: username 
                            });
                            console.log(`Sent file-delivered event to room ${senderIdStr}`);
                        } catch (err) {
                            console.error('Error processing pending file:', err);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching pending files:', error);
            }
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


            // 2. Rate Limiting
            if (!uploadLimiter.checkLimit(userId)) {
                socket.emit('upload-error', { message: 'Rate limit exceeded. Please wait.' });
                return;
            }

            // 3. Validation
            const validation = validateFile(fileName, size);
            if (!validation.valid) {
                socket.emit('upload-error', { message: validation.error });
                return;
            }

            // 4. Sanitization & ID Generation
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

        socket.on('upload-end', async (data: { fileId: string; fileName: string; isPrivate: boolean; recipientId?: string; senderId: string, senderName: string }) => {
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

            const fileTransfer = new FileTransfer({
                senderId: new mongoose.Types.ObjectId(senderId),
                recipientId: recipientId || undefined, 
                fileId,
                fileName,
                downloadUrl,
                fileSize: 0, 
                fileType: 'unknown', 
                status: 'pending'
            });

    
             fileTransfer.fileSize = 1; 
             fileTransfer.fileType = 'application/octet-stream';

            if (isPrivate && recipientId) {
                fileTransfer.recipientId = new mongoose.Types.ObjectId(recipientId);
                
                const recipient = onlineUsers.find(u => u.userId === recipientId);
                
                if (recipient) {
                    io.to(recipient.socketId).emit('file-shared', fileData);
                    socket.emit('file-sent', { ...fileData, recipientName: recipient.username });
                    
                    fileTransfer.status = 'delivered';
                } else {
                     // Recipient Offline
                     console.log(`User ${recipientId} is offline. File ${fileName} queued.`);
                     
                     // Fetch Name
                     const offlineUser = await UserModel.findById(recipientId);
                     const recipientName = offlineUser ? offlineUser.name : 'Unknown User';

                     socket.emit('file-sent', { ...fileData, recipientName: `${recipientName} (Queued)` });
                }
                
                // Save record
                fileTransfer.save().catch(err => console.error('Error saving file transfer:', err));

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
