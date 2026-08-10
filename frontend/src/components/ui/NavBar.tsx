'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_LINKS, ROUTES } from '@/constants/routes';

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="border-b-2 border-line bg-surface"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
        <Link href={ROUTES.landing} className="text-lg font-semibold tracking-tight">
          Defral
        </Link>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className={
                  pathname === link.href
                    ? 'font-semibold text-ink underline underline-offset-4'
                    : 'text-ink-muted transition-colors duration-200 ease-out hover:text-ink'
                }
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
