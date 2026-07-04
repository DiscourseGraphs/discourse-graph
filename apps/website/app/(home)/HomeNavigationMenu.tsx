"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

export type HomeNavigationItem = {
  href: string;
  isDocumentNavigation?: boolean;
  label: string;
};

type HomeNavigationMenuProps = {
  items: HomeNavigationItem[];
};

export const HomeNavigationMenu = ({
  items,
}: HomeNavigationMenuProps): React.ReactElement => {
  const desktopItems = items.filter((item) => !item.isDocumentNavigation);

  return (
    <>
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-neutral-dark/15 bg-neutral-light text-neutral-dark hover:border-neutral-dark/15 hover:bg-neutral-light hover:text-neutral-dark focus-visible:ring-neutral-dark/20 active:bg-neutral-light active:text-neutral-dark data-[state=open]:border-neutral-dark/15 data-[state=open]:bg-neutral-light data-[state=open]:text-neutral-dark min-[360px]:w-auto min-[360px]:px-4"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
              <span className="hidden min-[360px]:inline">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-48 border-neutral-dark/10 bg-white text-neutral-dark"
          >
            {items.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                {item.isDocumentNavigation ? (
                  // Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS.
                  // eslint-disable-next-line @next/next/no-html-link-for-pages
                  <a href={item.href}>{item.label}</a>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav aria-label="Primary navigation" className="hidden lg:flex">
        <ul className="flex flex-wrap justify-end gap-x-5 gap-y-2 text-sm font-medium text-neutral-dark/75">
          {desktopItems.map((item) => (
            <li key={item.href} className="shrink-0">
              {item.isDocumentNavigation ? (
                // Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS.
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a
                  href={item.href}
                  className="transition-colors hover:text-neutral-dark"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-neutral-dark"
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
};
