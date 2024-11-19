// src/utils/ffmpegUtils.ts
import ffmpeg from 'fluent-ffmpeg';

export const getVideoDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(Number(metadata.format.duration || 0));
            }
        });
    });
}

export const trimVideoFile = (
    inputPath: string,
    outputPath: string,
    start: number,
    end: number
): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(err);

            const duration = metadata.format.duration;
            if (duration === undefined || start < 0 || end <= start || start > duration || end > duration) {
                return reject(new Error("Invalid start or end time: ensure they are within the video's duration."));
            }

            ffmpeg(inputPath)
                .setStartTime(start)
                .setDuration(end - start)
                .output(outputPath)
                .on("end", () => resolve())
                .on("error", reject)
                .run();
        });
    });
};


export const mergeVideoFiles = (
    tempListFile: string,
    outputPath: string
): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(tempListFile)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions('-c copy')
            .output(outputPath)
            .on('start', (command) => {
                console.log('FFmpeg command:', command);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('FFmpeg stderr:', stderr);
                reject(new Error(`Failed to merge videos: ${err.message}`));
            })
            .on('end', () => {
                console.log('Merge completed successfully');
                resolve();
            })
            .run();
    });
};