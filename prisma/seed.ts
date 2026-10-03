import fs from "node:fs";
import path from "node:path";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
else if (fs.existsSync(".env")) process.loadEnvFile(".env");

// Self-contained on purpose: run via `node --experimental-strip-types`, which
// doesn't understand the app's "@/" path alias, so this avoids importing lib/*.
import pkg from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const { PrismaClient } = pkg;
const dbUrl = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

function baseSlugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "company";
}

async function generateUniqueCompanySlug(name: string): Promise<string> {
  const base = baseSlugify(name);
  let candidate = base;
  let suffix = 1;
  while (await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

interface SeedPackage {
  title: string;
  description: string;
  systemSizeKW: number;
  panelBrand: string;
  panelWattage: number;
  numberOfPanels: number;
  inverterBrand: string;
  inverterSizeKW: number;
  batteryBrand: string;
  batteryType: string;
  batteryCapacityKWh: number;
  priceUSD: number;
  warrantyYears: number;
  installationIncluded: boolean;
}

interface SeedCompany {
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  description: string;
  website: string;
  packages: SeedPackage[];
}

const companies: SeedCompany[] = [
  {
    name: "شركة الشمس الذهبية للطاقة المتجددة",
    email: "info@goldensun-demo.test",
    password: "demo12345",
    phone: "07701112233",
    city: "بغداد",
    description: "شركة عراقية متخصصة بتركيب أنظمة الطاقة الشمسية المنزلية والتجارية منذ 2015.",
    website: "https://goldensun-demo.test",
    packages: [
      {
        title: "باقة اقتصادية 3kW",
        description: "مناسبة للشقق والبيوت الصغيرة، تغطي الإنارة والأجهزة الأساسية.",
        systemSizeKW: 3.15,
        panelBrand: "Jinko Solar",
        panelWattage: 450,
        numberOfPanels: 7,
        inverterBrand: "Growatt",
        inverterSizeKW: 3.6,
        batteryBrand: "Narada",
        batteryType: "رصاص حمضي",
        batteryCapacityKWh: 5,
        priceUSD: 2800,
        warrantyYears: 5,
        installationIncluded: true,
      },
      {
        title: "باقة منزلية 5kW",
        description: "الأكثر طلباً للبيوت المتوسطة، تشغل المكيفات والثلاجة والإنارة.",
        systemSizeKW: 4.95,
        panelBrand: "Jinko Solar",
        panelWattage: 550,
        numberOfPanels: 9,
        inverterBrand: "Growatt",
        inverterSizeKW: 5,
        batteryBrand: "Pylontech",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 10,
        priceUSD: 6200,
        warrantyYears: 10,
        installationIncluded: true,
      },
      {
        title: "باقة منزلية موسعة 8kW",
        description: "للبيوت الكبيرة أو البيوت مع مسبح أو ورشة صغيرة.",
        systemSizeKW: 8.25,
        panelBrand: "JA Solar",
        panelWattage: 550,
        numberOfPanels: 15,
        inverterBrand: "Deye",
        inverterSizeKW: 8,
        batteryBrand: "Pylontech",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 15,
        priceUSD: 9800,
        warrantyYears: 10,
        installationIncluded: true,
      },
      {
        title: "باقة تجارية 12kW",
        description: "للمحلات التجارية والعيادات الصغيرة.",
        systemSizeKW: 12.1,
        panelBrand: "JA Solar",
        panelWattage: 550,
        numberOfPanels: 22,
        inverterBrand: "Deye",
        inverterSizeKW: 12,
        batteryBrand: "Dyness",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 20,
        priceUSD: 15500,
        warrantyYears: 12,
        installationIncluded: true,
      },
      {
        title: "باقة صناعية 20kW",
        description: "للمصانع الصغيرة والمولات، تغطي أحمال كبيرة على مدار اليوم.",
        systemSizeKW: 20.35,
        panelBrand: "Trina Solar",
        panelWattage: 550,
        numberOfPanels: 37,
        inverterBrand: "Huawei",
        inverterSizeKW: 20,
        batteryBrand: "Dyness",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 30,
        priceUSD: 26000,
        warrantyYears: 15,
        installationIncluded: true,
      },
    ],
  },
  {
    name: "مجموعة النور الأخضر للطاقة الشمسية",
    email: "sales@greennoor-demo.test",
    password: "demo12345",
    phone: "07809998877",
    city: "البصرة",
    description: "مجموعة متخصصة بحلول الطاقة الشمسية بأسعار تنافسية لجنوب العراق.",
    website: "https://greennoor-demo.test",
    packages: [
      {
        title: "باقة بداية 4kW",
        description: "حل اقتصادي بدون تركيب — مناسب لمن يريد التركيب الذاتي أو عبر فريقه.",
        systemSizeKW: 4.05,
        panelBrand: "Canadian Solar",
        panelWattage: 450,
        numberOfPanels: 9,
        inverterBrand: "Must Power",
        inverterSizeKW: 4,
        batteryBrand: "Narada",
        batteryType: "رصاص حمضي",
        batteryCapacityKWh: 8,
        priceUSD: 3600,
        warrantyYears: 5,
        installationIncluded: false,
      },
      {
        title: "باقة قياسية 6kW",
        description: "أفضل قيمة مقابل السعر لأغلب البيوت العراقية.",
        systemSizeKW: 6,
        panelBrand: "Canadian Solar",
        panelWattage: 500,
        numberOfPanels: 12,
        inverterBrand: "Must Power",
        inverterSizeKW: 6,
        batteryBrand: "Pylontech",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 12,
        priceUSD: 7200,
        warrantyYears: 8,
        installationIncluded: true,
      },
      {
        title: "باقة متقدمة 9kW",
        description: "للبيوت الكبيرة مع أجهزة تكييف مركزي.",
        systemSizeKW: 9,
        panelBrand: "Longi Solar",
        panelWattage: 500,
        numberOfPanels: 18,
        inverterBrand: "Deye",
        inverterSizeKW: 10,
        batteryBrand: "Pylontech",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 18,
        priceUSD: 11200,
        warrantyYears: 10,
        installationIncluded: true,
      },
      {
        title: "باقة فلل 14kW",
        description: "مصممة للفلل والمنازل الكبيرة ذات الاستهلاك العالي.",
        systemSizeKW: 14.3,
        panelBrand: "Longi Solar",
        panelWattage: 550,
        numberOfPanels: 26,
        inverterBrand: "Deye",
        inverterSizeKW: 15,
        batteryBrand: "Dyness",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 25,
        priceUSD: 18500,
        warrantyYears: 10,
        installationIncluded: true,
      },
      {
        title: "باقة مصانع صغيرة 25kW",
        description: "للورش والمصانع الصغيرة ذات الأحمال الثلاثية الطور.",
        systemSizeKW: 25.3,
        panelBrand: "Trina Solar",
        panelWattage: 550,
        numberOfPanels: 46,
        inverterBrand: "Huawei",
        inverterSizeKW: 25,
        batteryBrand: "Dyness",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 40,
        priceUSD: 32000,
        warrantyYears: 12,
        installationIncluded: true,
      },
    ],
  },
  {
    name: "شركة أفق الطاقة النظيفة",
    email: "contact@cleanhorizon-demo.test",
    password: "demo12345",
    phone: "07501234567",
    city: "أربيل",
    description: "شركة متخصصة بالحلول الشمسية الفاخرة والضمانات الممتدة لعملاء إقليم كوردستان.",
    website: "https://cleanhorizon-demo.test",
    packages: [
      {
        title: "باقة سمارت 3.5kW",
        description: "نظام مدمج بالكامل ببطارية ليثيوم عالية الجودة رغم الحجم الصغير.",
        systemSizeKW: 3.6,
        panelBrand: "REC Solar",
        panelWattage: 450,
        numberOfPanels: 8,
        inverterBrand: "SolarEdge",
        inverterSizeKW: 4,
        batteryBrand: "LG Chem",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 7,
        priceUSD: 4200,
        warrantyYears: 10,
        installationIncluded: true,
      },
      {
        title: "باقة عائلية 6.5kW",
        description: "توازن ممتاز بين السعر والجودة للعوائل المتوسطة.",
        systemSizeKW: 6.5,
        panelBrand: "REC Solar",
        panelWattage: 500,
        numberOfPanels: 13,
        inverterBrand: "SolarEdge",
        inverterSizeKW: 6,
        batteryBrand: "LG Chem",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 13,
        priceUSD: 8300,
        warrantyYears: 10,
        installationIncluded: true,
      },
      {
        title: "باقة بريميوم 10kW",
        description: "ضمان ممتد 15 سنة ومكونات من أفضل الماركات العالمية.",
        systemSizeKW: 9.9,
        panelBrand: "SunPower",
        panelWattage: 550,
        numberOfPanels: 18,
        inverterBrand: "SolarEdge",
        inverterSizeKW: 10,
        batteryBrand: "Tesla Powerwall",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 20,
        priceUSD: 13500,
        warrantyYears: 15,
        installationIncluded: true,
      },
      {
        title: "باقة فلل فاخرة 16kW",
        description: "للفلل الكبيرة والقصور، تغطي كل الأحمال بدون قيود.",
        systemSizeKW: 15.95,
        panelBrand: "SunPower",
        panelWattage: 550,
        numberOfPanels: 29,
        inverterBrand: "SMA",
        inverterSizeKW: 15,
        batteryBrand: "Tesla Powerwall",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 30,
        priceUSD: 21000,
        warrantyYears: 15,
        installationIncluded: true,
      },
      {
        title: "باقة تجارية كبرى 30kW",
        description: "للمجمعات التجارية والفنادق الصغيرة.",
        systemSizeKW: 30.25,
        panelBrand: "SunPower",
        panelWattage: 550,
        numberOfPanels: 55,
        inverterBrand: "SMA",
        inverterSizeKW: 30,
        batteryBrand: "Tesla Powerwall",
        batteryType: "ليثيوم",
        batteryCapacityKWh: 50,
        priceUSD: 39000,
        warrantyYears: 15,
        installationIncluded: true,
      },
    ],
  },
];

async function main() {
  for (const seedCompany of companies) {
    const existing = await prisma.company.findUnique({ where: { email: seedCompany.email } });
    if (existing) {
      console.log(`تخطي (موجودة مسبقاً): ${seedCompany.name}`);
      continue;
    }

    const slug = await generateUniqueCompanySlug(seedCompany.name);
    const passwordHash = await hashPassword(seedCompany.password);

    const company = await prisma.company.create({
      data: {
        name: seedCompany.name,
        slug,
        email: seedCompany.email,
        passwordHash,
        phone: seedCompany.phone,
        city: seedCompany.city,
        description: seedCompany.description,
        website: seedCompany.website,
        status: "approved",
        packages: { create: seedCompany.packages },
      },
    });

    console.log(`تم إنشاء: ${company.name} (${seedCompany.packages.length} باقات) — دخول: ${seedCompany.email} / ${seedCompany.password}`);
  }

  console.log("انتهت تعبئة البيانات التجريبية.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
