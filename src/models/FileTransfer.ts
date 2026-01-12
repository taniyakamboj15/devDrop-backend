import mongoose, { Document, Schema } from 'mongoose';

export interface IFileTransfer extends Document {
    senderId: mongoose.Types.ObjectId;
    recipientId: mongoose.Types.ObjectId;
    fileId: string; // Unique ID for the file (timestamp-random)
    fileName: string;
    downloadUrl: string;
    fileSize: number;
    fileType: string;
    status: 'pending' | 'delivered';
    createdAt: Date;
}

const fileTransferSchema = new Schema<IFileTransfer>(
    {
        senderId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        recipientId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        fileId: {
            type: String,
            required: true,
        },
        fileName: {
            type: String,
            required: true,
        },
        downloadUrl: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            required: true,
        },
        fileType: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'delivered'],
            default: 'pending',
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries on pending files for a recipient
fileTransferSchema.index({ recipientId: 1, status: 1 });

const FileTransfer = mongoose.model<IFileTransfer>('FileTransfer', fileTransferSchema);

export default FileTransfer;
