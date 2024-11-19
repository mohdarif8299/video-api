import { Router } from "express";
import multer from "multer";
import authenticate from "../middlewares/authMiddleware";
import {
    uploadVideoController,
    trimVideoController,
    generateShareableLinkController,
    validateShareableLinkController,
    mergeVideosController,
    streamSharedVideoController,
} from "../controllers/videoController";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", authenticate, upload.single("video"), uploadVideoController);
router.post("/trim/:id", authenticate, trimVideoController);
router.post('/merge/:ids', authenticate, mergeVideosController);
router.post("/share/:id", authenticate, generateShareableLinkController);
router.post("/share/:token",authenticate, validateShareableLinkController);
router.get('/share/:token', authenticate,streamSharedVideoController);  

export default router;
