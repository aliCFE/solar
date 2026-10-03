"use client";

import { useEffect, useRef } from "react";

interface Props {
  slot: string;
  className?: string;
}

/**
 * Google AdSense slot. Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT_ID is
 * set (AdSense won't serve on localhost/dev anyway — this just makes the
 * placement visible today, ready for a real publisher ID after deploy).
 */
export default function AdSlot({ slot, className }: Props) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!client) return;
    try {
      // @ts-expect-error -- injected globally by the AdSense script tag
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script not loaded yet or blocked — fail silently
    }
  }, [client]);

  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <div
          className={`flex items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] py-6 text-xs text-[var(--color-text-muted)] ${className ?? ""}`}
        >
          مكان إعلان (AdSense) — يظهر بعد نشر الموقع وإضافة NEXT_PUBLIC_ADSENSE_CLIENT_ID
        </div>
      );
    }
    return null;
  }

  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
