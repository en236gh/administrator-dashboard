"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ClipboardDocumentListIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  AcademicCapIcon,
  UserPlusIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "dashboard", icon: HomeIcon },
  { href: "/scheduling", label: "exam management", icon: AcademicCapIcon },
  { href: "/examinations", label: "examinations", icon: AcademicCapIcon },
  { href: "/attendance", label: "attendance", icon: ClipboardDocumentListIcon },
  { href: "/incidents", label: "incidents", icon: ExclamationTriangleIcon },
  { href: "/reports", label: "reports", icon: DocumentChartBarIcon },
  { href: "/staff", label: "staff onboarding", icon: UserPlusIcon },
  { href: "/assignments", label: "invigilator assignments", icon: UserGroupIcon },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[290px] flex-col overflow-hidden rounded-r-[10px] bg-white px-5 py-6 shadow-[8px_0_30px_rgba(15,23,42,0.04)]">
      <div className="mb-10 flex items-center justify-center px-2">
        <div className="relative h-36 w-36">
          <Image
            src="/UNZA.png"
            alt="University of Zambia"
            fill
            className="object-contain"
            priority
            sizes="144px"
          />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-[10px] px-3 py-3 text-sm font-medium capitalize transition-all duration-200",
                active
                  ? "bg-ink text-white shadow-lg shadow-black/10"
                  : "text-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <form action={logoutAction} className="mt-auto pt-4">
  <button
    type="submit"
    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-sm font-medium text-muted transition hover:bg-gray-100 hover:text-gray-700"
  >
    <ArrowRightOnRectangleIcon className="h-5 w-5" />
    <span>Sign out</span>
  </button>
</form>
    </aside>
  );
}
