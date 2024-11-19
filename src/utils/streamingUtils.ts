// src/utils/streamingUtils.ts
import { Response } from 'express';
import fs from 'fs';

export const handleRangeRequest = async (
    filepath: string,
    range: string,
    fileSize: number,
    res: Response
): Promise<void> => {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;

    const stream = fs.createReadStream(filepath, { start, end });
    const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    stream.pipe(res);
};

export const handleFullRequest = async (
    filepath: string,
    fileSize: number,
    res: Response
): Promise<void> => {
    const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
    };

    res.writeHead(200, head);
    fs.createReadStream(filepath).pipe(res);
};