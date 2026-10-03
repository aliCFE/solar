import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const UPLOAD_FOLDERS = ["roof-plans", "package-media"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export async function saveUploadedFile(file: File, folder: UploadFolder): Promise<string> {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error("نوع ملف غير مدعوم");

  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), buffer);

  return `/uploads/${folder}/${filename}`;
}

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime])
);

/**
 * Reads back a file previously saved by saveUploadedFile, given the public
 * URL it returned (e.g. "/uploads/roof-plans/xyz.jpg"). Used to feed an
 * already-uploaded image into an AI call without asking the browser to
 * upload the same bytes a second time.
 */
export async function readUploadedFile(publicUrl: string): Promise<{ base64: string; mediaType: string }> {
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const relative = publicUrl.replace(/^\//, "");

  // publicUrl comes from client-submitted form data (the assess request),
  // not just from our own upload response, so resolve and re-check it stays
  // inside uploadsRoot rather than trusting the "/uploads/" prefix alone.
  const filePath = path.normalize(path.join(process.cwd(), "public", relative));
  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    throw new Error("مسار ملف غير صالح");
  }

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = MIME_BY_EXT[ext];
  if (!mediaType) throw new Error("نوع ملف غير مدعوم");

  const buffer = await fs.readFile(filePath);
  return { base64: buffer.toString("base64"), mediaType };
}
