// src/controllers/videoController.ts
import { Request, Response } from "express";
import * as videoService from "../services/videoService";
import * as validationUtils from "../utils/validationUtils";
import * as streamingUtils from "../utils/streamingUtils";
import path from 'path';
import fs from "fs";

const handleError = (res: Response, error: Error, defaultStatus: number = 400) => {
    console.error('Error:', error);
    res.status(defaultStatus).json({ error: error.message });
};

export const uploadVideoController = async (req: Request, res: Response) => {
    try {
        const { sizeLimit, minDuration, maxDuration } = req.body;
        validationUtils.validateUploadConfig(
            Number(sizeLimit),
            Number(minDuration),
            Number(maxDuration)
        );

        const response = await videoService.uploadVideo(req.file as Express.Multer.File, {
            sizeLimit: Number(sizeLimit),
            minDuration: Number(minDuration),
            maxDuration: Number(maxDuration),
        });

        res.status(200).json(response);
    } catch (error) {
        handleError(res, error as Error);
    }
};

export const trimVideoController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { startTime, endTime } = req.body;

        validationUtils.validateTimeRange(Number(startTime), Number(endTime));

        const response = await videoService.trimVideo(
            Number(id),
            Number(startTime),
            Number(endTime)
        );
        res.status(200).json(response);
    } catch (error) {
        handleError(res, error as Error);
    }
};

export const mergeVideosController = async (req: Request, res: Response) => {
    try {
        const { ids } = req.params;
        const videoIds = validationUtils.validateMergeIds(ids);

        const response = await videoService.mergeVideos(videoIds);
        res.status(200).json(response);
    } catch (error) {
        handleError(res, error as Error);
    }
};

export const generateShareableLinkController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { expiryInHours } = req.body;

        if (!expiryInHours || isNaN(Number(expiryInHours)) || Number(expiryInHours) <= 0) {
            throw new Error('Invalid expiry hours');
        }

        const response = await videoService.generateShareableLink(
            Number(id),
            Number(expiryInHours)
        );
        res.status(200).json(response);
    } catch (error) {
        handleError(res, error as Error);
    }
};

export const streamSharedVideoController = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { video } = await videoService.validateShareableLink(token);

        const absolutePath = path.resolve(video.filepath);
        const stat = await fs.promises.stat(absolutePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            await streamingUtils.handleRangeRequest(absolutePath, range, fileSize, res);
        } else {
            await streamingUtils.handleFullRequest(absolutePath, fileSize, res);
        }
    } catch (error) {
        if ((error as Error).message === "Link has expired.") {
            handleError(res, error as Error, 410);
        } else {
            handleError(res, error as Error, 404);
        }
    }
};

export const validateShareableLinkController = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const response = await videoService.validateShareableLink(token);
        res.status(200).json({
            message: "Link is valid.",
            video: response.video
        });
    } catch (error) {
        handleError(res, error as Error, 404);
    }
};
