import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { requireAuth } from "../middleware/auth.js";

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

const MEDIA_DIR = process.env.MEDIA_DIR ?? "./media";
const ALLOWED_IMAGE = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const ALLOWED_DOCUMENT = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv"]);

const storage = multer.diskStorage({
  destination: MEDIA_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE.has(ext) || ALLOWED_DOCUMENT.has(ext)) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

mediaRouter.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const ext = path.extname(req.file.originalname).toLowerCase();
  const mediaType = ALLOWED_IMAGE.has(ext) ? "IMAGE" : "DOCUMENT";
  res.status(201).json({ mediaPath: req.file.path, mediaType });
});
