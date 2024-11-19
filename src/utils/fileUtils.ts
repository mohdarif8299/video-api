import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';

export const createUploadDirectory = async (dir: string): Promise<void> => {
    if (!fs.existsSync(dir)) {
        await fsPromises.mkdir(dir, { recursive: true });
    }
};

export const cleanupFile = async (filepath: string): Promise<void> => {
    try {
        if (fs.existsSync(filepath)) {
            await fsPromises.unlink(filepath);
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
};

export const generateUniqueFilename = (originalName: string): string => {
    const fileExtension = path.extname(originalName);
    const randomHash = crypto.randomBytes(16).toString('hex');
    return `${randomHash}${fileExtension}`;
};