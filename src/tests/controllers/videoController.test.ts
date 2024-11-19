// src/tests/controllers/videoController.test.ts
import request from 'supertest';
import { Request, Response, NextFunction } from 'express';
import * as videoService from '../../services/videoService';
import * as validationUtils from '../../utils/validationUtils';
import app from '../../server';
import path from 'path';
import fs from 'fs';

jest.mock('../../services/videoService');
jest.mock('../../utils/validationUtils');
jest.mock('../../utils/streamingUtils');

jest.mock('../../middlewares/authMiddleware', () => jest.fn((req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization === "Bearer valid-token") {
        return next();
    }
    res.status(403).json({ error: 'Invalid token.' });
}));

describe('Video Controller', () => {
    const TEST_VIDEO_PATH = path.join(__dirname, '../fixtures/test-video.mp4');
    const FIXTURES_DIR = path.join(__dirname, '../fixtures');
    const VALID_TOKEN = 'Bearer valid-token';

    beforeAll(async () => {
        if (!fs.existsSync(FIXTURES_DIR)) {
            fs.mkdirSync(FIXTURES_DIR, { recursive: true });
        }
        fs.writeFileSync(TEST_VIDEO_PATH, 'dummy video content');
    });

    afterAll(async () => {
        if (fs.existsSync(TEST_VIDEO_PATH)) {
            fs.unlinkSync(TEST_VIDEO_PATH);
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Upload Video', () => {
        it('successfully uploads a video with valid data', async () => {
            const mockResponse = {
                videoId: 1,
                filePath: '/uploads/test-video.mp4'
            };
            (videoService.uploadVideo as jest.Mock).mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/api/videos/upload')
                .set('Authorization', VALID_TOKEN)
                .attach('video', TEST_VIDEO_PATH)
                .field({
                    sizeLimit: '5000000',
                    minDuration: '10',
                    maxDuration: '300'
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockResponse);
        });

        it('returns 403 with missing authentication token', async () => {
            const response = await request(app)
                .post('/api/videos/upload')
                .attach('video', TEST_VIDEO_PATH);

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Invalid token.' });
        });

        it('handles validation errors for invalid configuration', async () => {
            (validationUtils.validateUploadConfig as jest.Mock)
                .mockImplementation(() => {
                    throw new Error('Invalid configuration');
                });

            const response = await request(app)
                .post('/api/videos/upload')
                .set('Authorization', VALID_TOKEN)
                .attach('video', TEST_VIDEO_PATH)
                .field({
                    sizeLimit: '-1',
                    minDuration: '0',
                    maxDuration: '10'
                });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Invalid configuration' });
        });
    });

    describe('Trim Video', () => {
        it('successfully trims a video with valid parameters', async () => {
            const mockResponse = { filepath: '/videos/trimmed-test.mp4' };
            (videoService.trimVideo as jest.Mock).mockResolvedValue(mockResponse);

            await request(app)
                .post('/api/videos/trim/1')
                .set('Authorization', VALID_TOKEN)
                .send({ startTime: 0, endTime: 30 })
                .expect(200)
                .expect(mockResponse);

            expect(videoService.trimVideo).toHaveBeenCalledWith(1, 0, 30);
        });

        it('handles trim operation errors', async () => {
            (videoService.trimVideo as jest.Mock).mockRejectedValue(new Error('Trim error'));

            await request(app)
                .post('/api/videos/trim/1')
                .set('Authorization', VALID_TOKEN)
                .send({ startTime: 0, endTime: 30 })
                .expect(400)
                .expect({ error: 'Trim error' });
        });
    });

    describe('Merge Videos', () => {
        it('successfully merges multiple videos', async () => {
            const mockResponse = { filepath: '/videos/merged.mp4' };
            const mergeMock = jest.spyOn(videoService, 'mergeVideos');
            mergeMock.mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/api/videos/merge/1,2')
                .set('Authorization', VALID_TOKEN);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockResponse);
        });

        it('handles merge operation errors', async () => {
            const mergeMock = jest.spyOn(videoService, 'mergeVideos');
            mergeMock.mockRejectedValue(new Error('Merge error'));

            const response = await request(app)
                .post('/api/videos/merge/1,2')
                .set('Authorization', VALID_TOKEN);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Merge error' });
        });
    });

    describe('Shareable Link', () => {
        it('generates a valid shareable link', async () => {
            const mockResponse = {
                id: 1,
                video_id: 1,
                token: 'mock-token',
                link: 'http://localhost/api/videos/share/mock-token',
                expiry: '2024-01-01T00:00:00.000Z',
            };
            (videoService.generateShareableLink as jest.Mock).mockResolvedValue(mockResponse);

            await request(app)
                .post('/api/videos/share/1')
                .set('Authorization', VALID_TOKEN)
                .send({ expiryInHours: 24 })
                .expect(200)
                .expect(mockResponse);

            expect(videoService.generateShareableLink).toHaveBeenCalledWith(1, 24);
        });

        it('handles invalid expiry duration', async () => {
            await request(app)
                .post('/api/videos/share/1')
                .set('Authorization', VALID_TOKEN)
                .send({ expiryInHours: -1 })
                .expect(400)
                .expect({ error: 'Invalid expiry hours' });
        });
    });

    describe('Validate Shareable Link', () => {
        it('validates an existing shareable link', async () => {
            const mockResponse = { videoId: 1, video: { id: 1, filename: 'test.mp4' } };
            (videoService.validateShareableLink as jest.Mock).mockResolvedValue(mockResponse);

            await request(app)
                .get('/api/videos/share/validate/mock-token')
                .set('Authorization', VALID_TOKEN)
                .expect(200)
                .expect({
                    message: 'Link is valid.',
                    video: mockResponse.video,
                });

            expect(videoService.validateShareableLink).toHaveBeenCalledWith('mock-token');
        });

        it('handles invalid or expired links', async () => {
            (videoService.validateShareableLink as jest.Mock)
                .mockRejectedValue(new Error('Invalid or expired link.'));

            await request(app)
                .get('/api/videos/share/validate/mock-token')
                .set('Authorization', VALID_TOKEN)
                .expect(404)
                .expect({ error: 'Invalid or expired link.' });
        });
    });
});