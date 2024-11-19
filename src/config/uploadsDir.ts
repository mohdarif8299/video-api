import fs from 'fs';
import path from 'path';

export const uploadsDir = (() => {
    const dir = path.resolve(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
})();
