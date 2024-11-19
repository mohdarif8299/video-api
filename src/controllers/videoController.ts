import { Request, Response } from "express";
import {
    uploadVideo,
    trimVideo,
    generateShareableLink,
    validateShareableLink,
    getShareableLinks,
    mergeVideos
} from "../services/videoService";
import path from 'path';
import fs from "fs";

export const uploadVideoController = async (req: Request, res: Response) => {
    try {
        const { sizeLimit, minDuration, maxDuration } = req.body;
        const response = await uploadVideo(req.file as Express.Multer.File, {
            sizeLimit: Number(sizeLimit),
            minDuration: Number(minDuration),
            maxDuration: Number(maxDuration),
        });
        res.status(200).json(response);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
};

export const trimVideoController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { startTime, endTime } = req.body;
        console.log(id, startTime, endTime);
        const response = await trimVideo(Number(id), Number(startTime), Number(endTime));
        res.status(200).json(response);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
};

export const mergeVideosController = async (req: Request, res: Response) => {
    try {
        const { ids } = req.params;
        const videoIds = ids.split(',').map(id => Number(id));


        console.log(videoIds);

        if (!Array.isArray(videoIds) || videoIds.length < 2) {
            throw new Error('At least two video IDs are required for merging');
        }
        2
        if (videoIds.some(id => isNaN(id) || !Number.isInteger(id) || id <= 0)) {
            throw new Error('Invalid video ID format. All IDs must be positive integers.');
        }

        const response = await mergeVideos(videoIds);
        res.status(200).json(response);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
};


export const generateShareableLinkController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { expiryInHours } = req.body;
        const response = await generateShareableLink(Number(id), Number(expiryInHours));
        res.status(200).json(response);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
};

export const streamSharedVideoController = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        
        const { video } = await validateShareableLink(token);
        
        const absolutePath = path.resolve(video.filepath);
        const stat = await fs.promises.stat(absolutePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(absolutePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(absolutePath).pipe(res);
        }
    } catch (error) {
        if ((error as Error).message === "Link has expired.") {
            res.status(410).json({ error: "This link has expired." });
        } else {
            res.status(404).json({ error: (error as Error).message });
        }
    }
};


export const validateShareableLinkController = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const response = await validateShareableLink(token);
        res.status(200).json({ message: "Link is valid.", video: response.video });
    } catch (error) {
        res.status(404).json({ error: (error as Error).message });
    }
};

