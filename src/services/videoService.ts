import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import crypto from "crypto";
import db from "../db/db";
import { promises as fsPromises } from 'fs'; 
import { Video, ShareableLink } from "../models/videoModel";

interface UploadConfig {
    sizeLimit: number;
    minDuration: number;
    maxDuration: number;
}

export const uploadVideo = async (
    file: Express.Multer.File,
    { sizeLimit, minDuration, maxDuration }: UploadConfig
): Promise<{ videoId: number; filePath: string }> => {
    try {
        if (!file || !file.path) {
            throw new Error('No file was uploaded');
        }

        const fileExtension = path.extname(file.originalname);
        const randomHash = crypto.randomBytes(16).toString('hex');
        const newFilename = `${randomHash}${fileExtension}`;
        const newFilePath = path.join(path.dirname(file.path), newFilename);

        try {
            await fs.promises.rename(file.path, newFilePath);
        } catch (error) {
            throw new Error('Failed to rename uploaded file');
        }

        const filePath = newFilePath;

        try {
            await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
        } catch (error) {
            throw new Error('File was not properly saved or is not accessible');
        }

        const stats = await fs.promises.stat(filePath);
        if (stats.size !== file.size) {
            throw new Error('File size mismatch - upload may be incomplete');
        }

        if (stats.size > sizeLimit) {
            throw new Error(`File size exceeds the limit of ${sizeLimit} bytes.`);
        }

        const duration = await getVideoDuration(filePath);
        if (duration < minDuration || duration > maxDuration) {
            throw new Error(
                `Video duration must be between ${minDuration} and ${maxDuration} seconds.`
            );
        }

        const result = await db.run(
            "INSERT INTO videos (filename, filepath, size, duration) VALUES (?, ?, ?, ?)",
            [file.originalname, filePath, stats.size, duration]
        );

        return {
            videoId: result.lastID,
            filePath,
        };
    } catch (error) {
        if (file?.path && fs.existsSync(file.path)) {
            try {
                await fs.promises.unlink(file.path);
            } catch (unlinkError) {
                console.error("Error deleting file:", (unlinkError as Error).message);
            }
        }
        throw error instanceof Error ? error : new Error('Unknown error occurred');
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
            "uploads", 
            `trimmed-${videoId}-${timestamp}.mp4`
        );

        await trimVideoFile(video.filepath, trimmedFilePath, startTime, endTime);

        const duration = await getVideoDuration(trimmedFilePath);

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
        try {
            const exists = await fsPromises.access(trimmedFilePath)
                .then(() => true)
                .catch(() => false);
                
            if (exists) {
                await fsPromises.unlink(trimmedFilePath);
            }
        } catch {
        }
        throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
};

export const mergeVideos = async (videoIds: number[]): Promise<{ filepath: string }> => {
    let tempListFile = '';
    let mergedFilePath = '';
    
    try {
        const videos = await Promise.all(
            videoIds.map(async (id) => {
                const video = await getVideoById(id);
                if (!video) {
                    throw new Error(`Video with ID ${id} not found`);
                }
                return video;
            })
        );

        const timestamp = Date.now();
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        
        if (!fs.existsSync(uploadsDir)) {
            await fsPromises.mkdir(uploadsDir, { recursive: true });
        }

        tempListFile = path.join(uploadsDir, `temp-${timestamp}.txt`);
        mergedFilePath = path.join(uploadsDir, `merged-${timestamp}.mp4`);

        const fileContent = videos
            .map(video => {
                const absolutePath = path.resolve(video.filepath);
                return `file '${absolutePath.replace(/'/g, "'\\''")}'`;
            })
            .join('\n');

        console.log('Temp file content:', fileContent);
        console.log('Temp file path:', tempListFile);
        
        await fsPromises.writeFile(tempListFile, fileContent);

        await fsPromises.access(tempListFile);

        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(tempListFile)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions('-c copy')
                .output(mergedFilePath)
                .on('start', (command) => {
                    console.log('FFmpeg command:', command);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('FFmpeg error:', err);
                    console.error('FFmpeg stderr:', stderr);
                    reject(new Error(`Failed to merge videos: ${err.message}`));
                })
                .on('end', () => {
                    console.log('Merge completed successfully');
                    resolve();
                })
                .run();
        });

        const duration = await getVideoDuration(mergedFilePath);
        const stats = await fsPromises.stat(mergedFilePath);

        await db.run(
            `INSERT INTO videos (
                filename,
                filepath,
                size,
                duration,
                merged_from
            ) VALUES (?, ?, ?, ?, ?)`,
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
        console.error('Merge error:', error);
        
        if (mergedFilePath && fs.existsSync(mergedFilePath)) {
            try {
                await fsPromises.unlink(mergedFilePath);
            } catch (err) {
                console.error('Error cleaning up merged file:', err);
            }
        }
        throw error;
    } finally {
        if (tempListFile && fs.existsSync(tempListFile)) {
            try {
                await fsPromises.unlink(tempListFile);
            } catch (err) {
                console.error('Error cleaning up temp file:', err);
            }
        }
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

export const getShareableLinks = async (videoId: number): Promise<ShareableLink[]> => {
    const rows = await db.all("SELECT * FROM shareable_links WHERE video_id = ? ORDER BY expiry DESC", [videoId]);

    return rows || [];
};

const getVideoDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(Number(metadata.format.duration || 0));
            }
        });
    });
};

const getVideoById = async (id: number): Promise<Video> => {
    try {
        const row = await db.get(
            "SELECT * FROM videos WHERE id = ?",
            [id]
        );

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
    } catch (error) {
        console.error('Error retrieving video:', error);
        throw error;
    }
};

const trimVideoFile = (
    inputPath: string,
    outputPath: string,
    start: number,
    end: number
): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .setStartTime(start)
            .setDuration(end - start)
            .output(outputPath)
            .on("end", () => resolve())
            .on("error", reject)
            .run();
    });
};

export default {
    uploadVideo,
    trimVideo,
    generateShareableLink,
    validateShareableLink
};
