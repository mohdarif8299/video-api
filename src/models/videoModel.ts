export interface Video {
    id: number;
    filename: string;
    filepath: string;
    size: number;
    duration: number;
    original_filepath: string;
    created_at: string;
    updated_at: string;
}

export interface ShareableLink {
    id: number;
    video_id: number;
    token: string;
    expiry: string;
    link: string;
}
