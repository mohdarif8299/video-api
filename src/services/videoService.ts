// src/services/videoService.ts
import { promises as fsPromises } from 'fs';
import path from 'path';
import db from "../db/db";
import crypto from 'crypto';
import { Video, ShareableLink } from "../models/videoModel";
import * as fileUtils from '../utils/fileUtils';
import * as ffmpegUtils from '../utils/ffmpegUtils';
import { UploadConfig } from '../types/video.types';

export const uploadVideo = async (
    file: Express.Multer.File,
    { sizeLimit, minDuration, maxDuration }: UploadConfig
): Promise<{ videoId: number; filePath: string }> => {
    try {
        if (!file || !file.path) {
            throw new Error('No file was uploaded');
        }

        const newFilename = fileUtils.generateUniqueFilename(file.originalname);
        const newFilePath = path.join(path.dirname(file.path), newFilename);

        await fsPromises.rename(file.path, newFilePath);
        await fsPromises.access(newFilePath, fsPromises.constants.F_OK | fsPromises.constants.R_OK);

        const stats = await fsPromises.stat(newFilePath);
        if (stats.size !== file.size) {
            throw new Error('File size mismatch - upload may be incomplete');
        }

        if (stats.size > sizeLimit) {
            throw new Error(`File size exceeds the limit of ${sizeLimit} bytes.`);
        }

        const duration = await ffmpegUtils.getVideoDuration(newFilePath);
        if (duration < minDuration || duration > maxDuration) {
            throw new Error(
                `Video duration must be between ${minDuration} and ${maxDuration} seconds.`
            );
        }

        const result = await db.run(
            "INSERT INTO videos (filename, filepath, size, duration) VALUES (?, ?, ?, ?)",
            [file.originalname, newFilePath, stats.size, duration]
        );

        return {
            videoId: result.lastID,
            filePath: newFilePath,
        };
    } catch (error) {
        if (file?.path) {
            await fileUtils.cleanupFile(file.path);
        }
        throw error;
    }
};

export const trimVideo = async (
    videoId: number,
    startTime: number,
    endTime: number
): Promise<{ filepath: string }> => {
    let trimmedFilePath = '';
    try {
        const video = await getVideoById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        const timestamp = Date.now();
        trimmedFilePath = path.join(
            __dirname, 
            "..", 
            "trimmed-videos", 
            `trimmed-${videoId}-${timestamp}.mp4`
        );

        await ffmpegUtils.trimVideoFile(video.filepath, trimmedFilePath, startTime, endTime);
        const duration = await ffmpegUtils.getVideoDuration(trimmedFilePath);
        const stats = await fsPromises.stat(trimmedFilePath);

        await db.run(
            `UPDATE videos 
             SET filepath = ?, 
                 duration = ?,
                 size = ?,
                 updated_at = CURRENT_TIMESTAMP,
                 original_filepath = CASE 
                                     WHEN original_filepath IS NULL 
                                     THEN ? 
                                     ELSE original_filepath 
                                   END
             WHERE id = ?`,
            [trimmedFilePath, duration, stats.size, video.filepath, videoId]
        );

        return { filepath: trimmedFilePath };
    } catch (error) {
        await fileUtils.cleanupFile(trimmedFilePath);
        throw error;
    }
};

export const mergeVideos = async (videoIds: number[]): Promise<{ filepath: string }> => {
    let tempListFile = '';
    let mergedFilePath = '';
    
    try {
        const videos = await Promise.all(
            videoIds.map(id => getVideoById(id))
        );

        const timestamp = Date.now();
        const uploadsDir = path.join(__dirname, '..', 'merged-videos');
        
        await fileUtils.createUploadDirectory(uploadsDir);

        tempListFile = path.join(uploadsDir, `temp-${timestamp}.txt`);
        mergedFilePath = path.join(uploadsDir, `merged-${timestamp}.mp4`);

        const fileContent = videos
            .map(video => {
                const absolutePath = path.resolve(video.filepath);
                return `file '${absolutePath.replace(/'/g, "'\\''")}'`;
            })
            .join('\n');

        await fsPromises.writeFile(tempListFile, fileContent);
        await ffmpegUtils.mergeVideoFiles(tempListFile, mergedFilePath);

        const duration = await ffmpegUtils.getVideoDuration(mergedFilePath);
        const stats = await fsPromises.stat(mergedFilePath);

        await db.run(
            `INSERT INTO videos (filename, filepath, size, duration, merged_from) 
             VALUES (?, ?, ?, ?, ?)`,
            [
                `merged-${timestamp}.mp4`,
                mergedFilePath,
                stats.size,
                duration,
                JSON.stringify(videoIds)
            ]
        );

        return { filepath: mergedFilePath };
    } catch (error) {
        await fileUtils.cleanupFile(mergedFilePath);
        throw error;
    } finally {
        await fileUtils.cleanupFile(tempListFile);
    }
};

export const generateShareableLink = async (
    videoId: number,
    expiryInHours: number
): Promise<ShareableLink> => {
    await getVideoById(videoId);
    const token = crypto.randomBytes(16).toString("hex");
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + expiryInHours);

    const result = await db.run(
        "INSERT INTO shareable_links (video_id, token, expiry) VALUES (?, ?, ?)",
        [videoId, token, expiry.toISOString()]
    );

    return {
        id: result.lastID,
        video_id: videoId,
        token,
        link: `http://localhost:3000/api/videos/share/${token}`,
        expiry: expiry.toISOString(),
    };
};

export const validateShareableLink = async (token: string): Promise<{ videoId: number; video: Video }> => {
    const row = await db.get(
        "SELECT video_id, expiry FROM shareable_links WHERE token = ?",
        [token]
    );

    if (!row) {
        throw new Error("Link not found or invalid.");
    }

    if (new Date(row.expiry) < new Date()) {
        await db.run("DELETE FROM shareable_links WHERE token = ?", [token]);
        throw new Error("Link has expired.");
    }

    const video = await getVideoById(row.video_id);
    return { videoId: row.video_id, video };
};

const getVideoById = async (id: number): Promise<Video> => {
    const row = await db.get("SELECT * FROM videos WHERE id = ?", [id]);

    if (!row) {
        throw new Error(`No video found with ID ${id}`);
    }

    return {
        id: Number(row.id),
        filename: String(row.filename),
        filepath: String(row.filepath),
        size: Number(row.size),
        duration: Number(row.duration),
        original_filepath: String(row.original_filepath),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    };
};