"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const LINKS = [
  { href: "/", label: "Today", icon: "📅" },
  { href: "/plan", label: "2-Week Plan", icon: "📋" },
  { href: "/progression", label: "Progression", icon: "📈" },
  { href: "/log", label: "Log", icon: "📝" },
  { href: "/trends", label: "Trends", icon: "📊" },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  return (
    <div className="mb-5">
      <nav className="flex gap-1.5 flex-wrap">
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
      {session && (
        <div className="flex items-center justify-end gap-3 mt-2">
          <span className="text-xs text-slate-500">
            Signed in as{" "}
            <span className="text-slate-300 font-medium">
              {session.userName}
            </span>
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
