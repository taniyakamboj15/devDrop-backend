import crypto from 'crypto';
import path from 'path';

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed extensions
const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.txt', '.md',
    '.zip', '.rar', '.7z',
    '.mp4', '.webm', '.mp3', '.wav',
    '.js', '.ts', '.py', '.json', '.html', '.css' // Source files for "DevDrop"
]);

export const generateFileId = (): string => {
    return crypto.randomUUID();
};

export const sanitizeFilename = (fileName: string): string => {
    // Remove directory traversal characters and non-alphanumeric chars (except . - _)
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    // Ensure it doesn't start with dots (hidden files)
    return safeName.replace(/^\.+/, '');
};

export const validateFile = (fileName: string, size: number): { valid: boolean; error?: string } => {
    if (size > MAX_FILE_SIZE) {
        return { valid: false, error: 'File size exceeds 50MB limit.' };
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return { valid: false, error: `File type ${ext} is not allowed.` };
    }

    return { valid: true };
};
