// src/tests/services/videoService.test.ts
import { promises as fsPromises } from 'fs';
import * as fileUtils from '../../utils/fileUtils';
import * as ffmpegUtils from '../../utils/ffmpegUtils';
import {
    generateShareableLink,
    mergeVideos,
    trimVideo,
    uploadVideo,
    validateShareableLink,
} from '../../services/videoService';

jest.mock('fs', () => ({
    promises: {
        rename: jest.fn(),
        access: jest.fn(),
        stat: jest.fn(),
        writeFile: jest.fn(),
        constants: { F_OK: 0, R_OK: 4 },
    },
}));

jest.mock('../../utils/fileUtils');
jest.mock('../../utils/ffmpegUtils');

const mockDb = {
    run: jest.fn(),
    get: jest.fn(),
    close: jest.fn(),
};

jest.mock('../../db/db', () => jest.fn(() => mockDb));

describe('Video Service', () => {
    const TEST_CONFIG = {
        mockFile: {
            originalname: 'test.mp4',
            path: '/temp/test.mp4',
            size: 1024 * 1024,
        } as Express.Multer.File,
        uploadConfig: {
            sizeLimit: 2 * 1024 * 1024,
            minDuration: 5,
            maxDuration: 300,
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Upload Functionality', () => {
        it('validates and uploads video successfully', async () => {
            jest.spyOn(fileUtils, 'generateUniqueFilename').mockReturnValue('unique-test.mp4');
            jest.spyOn(ffmpegUtils, 'getVideoDuration').mockResolvedValue(60);
            jest.spyOn(fsPromises, 'rename').mockResolvedValue(undefined);
            jest.spyOn(fsPromises, 'stat').mockResolvedValue({ size: TEST_CONFIG.mockFile.size } as any);
            mockDb.run.mockResolvedValue({ lastID: 1 });

            const result = await uploadVideo(TEST_CONFIG.mockFile, TEST_CONFIG.uploadConfig);

            expect(result).toEqual({
                videoId: 1,
                filePath: expect.any(String)
            });
            expect(ffmpegUtils.getVideoDuration).toHaveBeenCalledWith(expect.any(String));
            expect(mockDb.run).toHaveBeenCalledWith(
                'INSERT INTO videos (filename, filepath, size, duration) VALUES (?, ?, ?, ?)',
                [TEST_CONFIG.mockFile.originalname, expect.any(String), TEST_CONFIG.mockFile.size, 60]
            );
        });

        it('rejects files exceeding size limit', async () => {
            jest.spyOn(fsPromises, 'stat').mockResolvedValue({ size: 3 * 1024 * 1024 } as any);

            await expect(uploadVideo(TEST_CONFIG.mockFile, TEST_CONFIG.uploadConfig))
                .rejects
                .toThrow('File size exceeds the limit of 2097152 bytes.');
        });
    });

    describe('Video Trimming', () => {
        const VIDEO_ID = 1;
        const MOCK_VIDEO = {
            id: VIDEO_ID,
            filepath: '/videos/test.mp4'
        };

        it('trims video with valid parameters', async () => {
            mockDb.get.mockResolvedValue(MOCK_VIDEO);
            jest.spyOn(ffmpegUtils, 'trimVideoFile').mockResolvedValue(undefined);
            jest.spyOn(fsPromises, 'stat').mockResolvedValue({ size: 500000 } as any);
            jest.spyOn(ffmpegUtils, 'getVideoDuration').mockResolvedValue(30);
            mockDb.run.mockResolvedValue({});

            const result = await trimVideo(VIDEO_ID, 0, 30);

            expect(result).toEqual({ filepath: expect.stringContaining('trimmed-1') });
            expect(ffmpegUtils.trimVideoFile).toHaveBeenCalledWith(
                MOCK_VIDEO.filepath,
                expect.any(String),
                0,
                30
            );
        });

        it('handles non-existent video ID', async () => {
            mockDb.get.mockResolvedValue(null);

            await expect(trimVideo(VIDEO_ID, 0, 30))
                .rejects
                .toThrow(`No video found with ID ${VIDEO_ID}`);
        });
    });

    describe('Video Merging', () => {
        const TEST_VIDEOS = [
            { id: 1, filepath: '/videos/test1.mp4' },
            { id: 2, filepath: '/videos/test2.mp4' }
        ];

        it('merges multiple videos successfully', async () => {
            mockDb.get
                .mockResolvedValueOnce(TEST_VIDEOS[0])
                .mockResolvedValueOnce(TEST_VIDEOS[1]);
            jest.spyOn(ffmpegUtils, 'mergeVideoFiles').mockResolvedValue(undefined);
            jest.spyOn(fsPromises, 'stat').mockResolvedValue({ size: 1000000 } as any);
            jest.spyOn(ffmpegUtils, 'getVideoDuration').mockResolvedValue(120);
            mockDb.run.mockResolvedValue({ lastID: 3 });

            const result = await mergeVideos([1, 2]);

            expect(result).toEqual({ filepath: expect.stringContaining('merged') });
            expect(ffmpegUtils.mergeVideoFiles).toHaveBeenCalled();
        });

        it('handles missing source video', async () => {
            mockDb.get.mockResolvedValue(null);

            await expect(mergeVideos([1]))
                .rejects
                .toThrow('No video found with ID 1');
        });
    });

    describe('Shareable Link', () => {
        const TEST_VIDEO = {
            id: 1,
            filename: 'test.mp4',
            filepath: '/videos/test.mp4'
        };

        it('generates valid shareable link', async () => {
            mockDb.get.mockResolvedValue(TEST_VIDEO);
            mockDb.run.mockResolvedValue({ lastID: 1 });

            const result = await generateShareableLink(1, 24);

            expect(result).toMatchObject({
                id: 1,
                video_id: 1,
                token: expect.any(String),
                link: expect.any(String),
                expiry: expect.any(String)
            });
        });

        it('validates active shareable link', async () => {
            const mockLink = {
                video_id: 1,
                expiry: new Date(Date.now() + 3600000).toISOString()
            };

            const mockVideo = {
                ...TEST_VIDEO,
                size: 1024 * 1024,
                duration: 60,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                original_filepath: '/videos/test.mp4'
            };

            mockDb.get
                .mockResolvedValueOnce(mockLink)
                .mockResolvedValueOnce(mockVideo);

            const result = await validateShareableLink('mock-token');

            expect(result).toEqual({
                videoId: 1,
                video: mockVideo
            });
        });

        it('rejects expired link', async () => {
            mockDb.get.mockResolvedValue({
                video_id: 1,
                expiry: new Date(Date.now() - 3600000).toISOString()
            });

            await expect(validateShareableLink('mock-token'))
                .rejects
                .toThrow('Link has expired');
        });

        it('rejects invalid token', async () => {
            mockDb.get.mockResolvedValue(null);

            await expect(validateShareableLink('invalid-token'))
                .rejects
                .toThrow('Link not found or invalid.');
        });

        it('handles missing video for valid link', async () => {
            mockDb.get
                .mockResolvedValueOnce({
                    video_id: 1,
                    expiry: new Date(Date.now() + 3600000).toISOString()
                })
                .mockResolvedValueOnce(null);

            await expect(validateShareableLink('mock-token'))
                .rejects
                .toThrow('No video found with ID 1');
        });
    });
});