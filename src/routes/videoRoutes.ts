// src/routes/videoRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import * as videoController from '../controllers/videoController';
import authenticate from '../middlewares/authMiddleware';

const router = Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Not a video file'));
        }
    }
});

// Routes
router.post('/upload', authenticate, upload.single('video'), videoController.uploadVideoController);
router.post('/trim/:id', authenticate, videoController.trimVideoController);
router.post('/merge/:ids', authenticate, videoController.mergeVideosController);
router.post('/share/:id', authenticate, videoController.generateShareableLinkController);
router.get('/share/:token', videoController.streamSharedVideoController);
router.get('/share/validate/:token', authenticate, videoController.validateShareableLinkController);

export default router;