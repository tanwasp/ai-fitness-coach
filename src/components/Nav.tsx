"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today", icon: "📅" },
  { href: "/plan", label: "2-Week Plan", icon: "📋" },
  { href: "/progression", label: "Progression", icon: "📈" },
  { href: "/log", label: "Log", icon: "📝" },
  { href: "/trends", label: "Trends", icon: "📊" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 flex-wrap mb-5">
      {LINKS.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`
              flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold
              transition-all duration-150 select-none
              ${
                active
                  ? "bg-accent-blue/20 text-accent-blue border border-accent-blue/40 shadow-sm shadow-accent-blue/10"
                  : "bg-surface-card text-slate-400 border border-surface-border hover:text-slate-200 hover:bg-surface-hover"
              }
            `}
          >
            <span className="text-base leading-none">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
