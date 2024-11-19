// src/types/video.types.ts
export interface UploadConfig {
    sizeLimit: number;
    minDuration: number;
    maxDuration: number;
}

export interface Video {
    id: number;
    filename: string;
    filepath: string;
    size: number;
    duration: number;
    original_filepath?: string;
    merged_from?: string;
    created_at: string;
    updated_at: string;
}

export interface ShareableLink {
    id: number;
    video_id: number;
    token: string;
    link: string;
    expiry: string;
}

export interface VideoUploadResponse {
    videoId: number;
    filePath: string;
}

export interface VideoTrimResponse {
    filepath: string;
}

export interface VideoMergeResponse {
    filepath: string;
}