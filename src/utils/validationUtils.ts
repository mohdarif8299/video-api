// src/utils/validationUtils.ts
export const validateUploadConfig = (
    sizeLimit?: number,
    minDuration?: number,
    maxDuration?: number
): void => {
    if (!sizeLimit || !minDuration || !maxDuration) {
        throw new Error('Missing required upload configuration');
    }

    if (minDuration >= maxDuration) {
        throw new Error('Minimum duration must be less than maximum duration');
    }
};

export const validateTimeRange = (startTime: number, endTime: number): void => {
    if (isNaN(startTime) || isNaN(endTime)) {
        throw new Error('Invalid time format');
    }

    if (startTime < 0 || endTime <= startTime) {
        throw new Error('Invalid time range');
    }
};

export const validateMergeIds = (ids: string): number[] => {
    const videoIds = ids.split(',').map(id => Number(id));

    if (!Array.isArray(videoIds) || videoIds.length < 2) {
        throw new Error('At least two video IDs are required for merging');
    }

    if (videoIds.some(id => isNaN(id) || !Number.isInteger(id) || id <= 0)) {
        throw new Error('Invalid video ID format. All IDs must be positive integers.');
    }

    return videoIds;
};