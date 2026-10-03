"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "الشركات المسجلة" },
  { href: "/admin/leads", label: "طلبات الزباين" },
  { href: "/admin/discovered", label: "الشركات المكتشفة" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active
                ? "border-[var(--color-accent)] font-semibold text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
