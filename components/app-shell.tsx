"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const routes = [
  { href: "/", label: "Home" },
  { href: "/test", label: "Try features" },
  { href: "/admin", label: "Settings" },
] as const;

function isRouteActive(href: string, pathname: string | null) {
  return href === "/"
    ? pathname === "/" || pathname === ""
    : pathname === href || pathname?.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  pathname,
  onPick,
}: {
  href: string;
  label: string;
  pathname: string | null;
  onPick: () => void;
}) {
  const active = isRouteActive(href, pathname);
  return (
    <li>
      <Link
        href={href}
        onClick={onPick}
        className={cn(
          "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-foreground hover:bg-muted"
        )}
      >
        {label}
      </Link>
    </li>
  );
}

function HeaderInlineLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string | null;
}) {
  const active = isRouteActive(href, pathname);
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="shrink-0 text-sm font-semibold tracking-tight text-foreground sm:text-base"
          >
            Job outreach
          </Link>
          <nav
            className="hidden items-center gap-0.5 lg:flex"
            aria-label="Main"
          >
            {routes.map((r) => (
              <HeaderInlineLink
                key={r.href}
                href={r.href}
                label={r.label}
                pathname={pathname}
              />
            ))}
          </nav>
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground transition-colors hover:bg-muted lg:hidden"
            aria-expanded={open ? "true" : "false"}
            aria-controls="app-drawer"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </header>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          aria-label="Close menu"
          onClick={close}
        />
      ) : null}

      <aside
        id="app-drawer"
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[min(20rem,100vw)] flex-col border-l border-border bg-card shadow-lg transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
        aria-hidden={open ? undefined : true}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-sm font-semibold">Menu</span>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close menu"
            onClick={close}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Main">
          <ul className="space-y-0.5">
            {routes.map((r) => (
              <NavLink
                key={r.href}
                href={r.href}
                label={r.label}
                pathname={pathname}
                onPick={close}
              />
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
