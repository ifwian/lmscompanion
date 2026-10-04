"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/courses", label: "Courses" },
  { href: "/activities", label: "Activities" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
];

export default function AppNav({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <header className="nav">
      <a className="skip-link" href="#main">Skip to content</a>
      <Link href="/dashboard" className="nav-brand">
        <span className="nav-wordmark">e-GURO</span>
        <span className="nav-sub">Companion</span>
      </Link>
      <nav aria-label="Main">
        <ul className="nav-list">
          {LINKS.map((link, index) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={active ? "page" : undefined} className={active ? "nav-link is-active" : "nav-link"}>
                  <span className="nav-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="nav-foot">
        <ThemeToggle />
        <p className="nav-user">
          <span className="nav-avatar" aria-hidden="true">{name.trim().charAt(0) || "?"}</span>
          <span>{name}</span>
        </p>
      </div>
    </header>
  );
}
