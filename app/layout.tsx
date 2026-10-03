import type { Metadata } from "next";
import Script from "next/script";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة تقييم الطاقة الشمسية",
  description: "احسب احتياجك من الطاقة الشمسية وقارن عروض الأسعار بمساعدة الذكاء الاصطناعي",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen">
        {adsenseClientId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <NavBar />
        {children}
      </body>
    </html>
  );
}
