import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";
import { saveUploadedFile } from "@/lib/uploads";

const MAX_BYTES = 15 * 1024 * 1024;
const YOUTUBE_OR_VIMEO = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i;

async function assertOwnership(packageId: string, companyId: string) {
  const pkg = await prisma.solarPackage.findUnique({ where: { id: packageId }, select: { companyId: true } });
  if (!pkg) return { ok: false as const, status: 404, error: "الباقة غير موجودة" };
  if (pkg.companyId !== companyId) return { ok: false as const, status: 403, error: "غير مصرح" };
  return { ok: true as const };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: packageId } = await params;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const ownership = await assertOwnership(packageId, companyId);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  const formData = await req.formData();
  const file = formData.get("file");
  const videoUrl = formData.get("videoUrl");
  const caption = formData.get("caption");

  const existingCount = await prisma.media.count({ where: { packageId } });

  if (file instanceof File) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "حجم الصورة كبير جداً (الحد الأقصى 15MB)" }, { status: 400 });
    }
    try {
      const url = await saveUploadedFile(file, "package-media");
      const media = await prisma.media.create({
        data: {
          packageId,
          type: "image",
          url,
          caption: typeof caption === "string" && caption ? caption : null,
          sortOrder: existingCount,
        },
      });
      return NextResponse.json(media, { status: 201 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "فشل رفع الصورة" }, { status: 400 });
    }
  }

  if (typeof videoUrl === "string" && videoUrl.trim()) {
    if (!YOUTUBE_OR_VIMEO.test(videoUrl.trim())) {
      return NextResponse.json({ error: "رابط الفيديو لازم يكون من YouTube أو Vimeo" }, { status: 400 });
    }
    const media = await prisma.media.create({
      data: {
        packageId,
        type: "video-url",
        url: videoUrl.trim(),
        caption: typeof caption === "string" && caption ? caption : null,
        sortOrder: existingCount,
      },
    });
    return NextResponse.json(media, { status: 201 });
  }

  return NextResponse.json({ error: "أرفق صورة أو رابط فيديو" }, { status: 400 });
}
