import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/requireAuth.js";
import { attachmentRateLimit } from "../../middleware/rateLimits.js";
import { canPostMessage, canReadConversation } from "../../policies/authorize.js";
import { getFileStream, isStorageConfigured, uploadFile } from "../../lib/storage.js";
import { getMembership, getPostingMembership } from "../conversations/service.js";
import { detectFileType } from "./fileSignature.js";
import { attachmentIdParamsSchema, attachmentNameSchema } from "./schema.js";
import { createMessage, findAttachment } from "./service.js";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// memoryStorage: the file is only held long enough to check its bytes and
// forward it to R2 — never written to the container's disk (which Railway
// wipes on every deploy anyway). The 5MB cap bounds that memory use.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 0 },
  // Browsers send UTF-8 filenames; busboy's default (latin1) would turn
  // "réunion.pdf" into mojibake.
  defParamCharset: "utf8",
}).single("file");

// Turns multer's errors into our { error: { code, message } } shape
// instead of letting them fall through to a generic 500.
function parseSingleFile(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendError(res, 413, "FILE_TOO_LARGE", "File exceeds the 5 MB limit");
    }
    if (err instanceof multer.MulterError) {
      return sendError(res, 400, "VALIDATION_ERROR", "Send exactly one file in the \"file\" field");
    }
    next(err);
  });
}

// --- POST /api/conversations/:id/attachments ---------------------------

export const uploadRouter = Router({ mergeParams: true });

// Membership is checked BEFORE multer reads the body, so a non-member
// can't make the server buffer 5MB of memory for nothing.
async function requirePostingMember(req, res, next) {
  try {
    const membership = await getPostingMembership(req.params.id, req.user.id);
    // 404, never 403, for non-members: same rule as message history.
    if (!canReadConversation(req.user, membership)) {
      return sendError(res, 404, "NOT_FOUND", "Conversation not found");
    }
    if (!canPostMessage(req.user, membership)) {
      return sendError(res, 403, "RECIPIENT_GONE", "The other person deleted their account");
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireStorage(_req, res, next) {
  if (!isStorageConfigured()) {
    return sendError(res, 503, "STORAGE_UNAVAILABLE", "File storage is not configured");
  }
  next();
}

uploadRouter.post(
  "/",
  requireAuth,
  attachmentRateLimit,
  requirePostingMember,
  requireStorage,
  parseSingleFile,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return sendError(res, 400, "VALIDATION_ERROR", "Send exactly one file in the \"file\" field");
      }

      // The declared mimetype is ignored on purpose: the bytes decide.
      const detected = detectFileType(req.file.buffer);
      if (!detected) {
        return sendError(res, 422, "UNSUPPORTED_FILE_TYPE", "Only PNG, JPEG, WEBP, GIF and PDF files are allowed");
      }

      const name = attachmentNameSchema.parse(req.file.originalname);
      // Random key, never the user's filename: no collisions, no path
      // tricks ("../"), and nothing guessable about other people's files.
      const key = `conversations/${req.params.id}/${randomUUID()}.${detected.ext}`;
      await uploadFile(req.file.buffer, key, detected.type);

      const message = await createMessage(req.params.id, req.user.id, "", {
        key,
        type: detected.type,
        name,
        size: req.file.size,
      });

      // Same "message:new" event as a typed message, so the client's
      // existing live-update path shows it with no special case.
      // (io is absent in supertest runs that don't attach one.)
      req.app.get("io")?.to(`conversation:${req.params.id}`).emit("message:new", {
        conversationId: req.params.id,
        message,
      });
      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  },
);

// --- GET /api/attachments/:messageId -----------------------------------

export const downloadRouter = Router();

// RFC 5987 form so non-ASCII filenames survive the header; the plain
// filename= fallback strips anything that could break the header's quoting.
function contentDisposition(name) {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

downloadRouter.get("/:messageId", requireAuth, async (req, res, next) => {
  const parsed = attachmentIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 404, "NOT_FOUND", "Attachment not found");
  }

  try {
    const attachment = await findAttachment(parsed.data.messageId);
    const membership = attachment ? await getMembership(attachment.conversationId, req.user.id) : null;
    // Same 404 for "no such attachment" and "not your conversation", so the
    // response never confirms that a given message id exists.
    if (!attachment || !canReadConversation(req.user, membership)) {
      return sendError(res, 404, "NOT_FOUND", "Attachment not found");
    }
    if (!isStorageConfigured()) {
      return sendError(res, 503, "STORAGE_UNAVAILABLE", "File storage is not configured");
    }

    const stream = await getFileStream(attachment.attachmentUrl);
    res.set({
      "Content-Type": attachment.attachmentType,
      "Content-Disposition": contentDisposition(attachment.attachmentName),
      // private: only the user's browser may cache it, never a shared proxy —
      // the file is members-only. A stored object never changes, so caching is safe.
      "Cache-Control": "private, max-age=86400",
    });
    stream.on("error", (err) => (res.headersSent ? res.destroy(err) : next(err)));
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});
