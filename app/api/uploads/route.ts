import { NextRequest, NextResponse } from "next/server";
import { saveUploadedFile, UPLOAD_FOLDERS, type UploadFolder } from "@/lib/uploads";
import { rateLimitOrNull } from "@/lib/rateLimit";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "uploads", limit: 20, windowMs: 15 * 60_000 });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("file");
  const folder = formData.get("folder");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "لم يتم رفع ملف" }, { status: 400 });
  }
  if (typeof folder !== "string" || !UPLOAD_FOLDERS.includes(folder as UploadFolder)) {
    return NextResponse.json({ error: "وجهة رفع غير صحيحة" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "حجم الملف كبير جداً (الحد الأقصى 15MB)" }, { status: 400 });
  }

  try {
    const url = await saveUploadedFile(file, folder as UploadFolder);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل رفع الملف" },
      { status: 400 }
    );
  }
}
