"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PlatformBadge } from "./PlatformBadge";

const DOCS_PLATFORMS = {
  "/docs/obsidian/": "obsidian",
  "/docs/roam/": "roam",
} as const;

export const Logo = () => {
  const pathname = usePathname();
  
  const platform = Object.entries(DOCS_PLATFORMS).find(([path]) =>
    pathname.startsWith(path),
  )?.[1] as "obsidian" | "roam" | undefined;

  return (
    <div className="flex items-center space-x-2">
      <Link href="/" className="flex items-center space-x-2">
        <Image
          src="/logo-screenshot-48.png"
          alt="Discourse Graphs Logo"
          width={48}
          height={48}
        />

        <span className="text-3xl font-bold text-neutral-dark">
          Discourse Graphs
        </span>
      </Link>
      {platform && (
        <div className="">
          <PlatformBadge platform={platform} />
        </div>
      )}
    </div>
  );
};
