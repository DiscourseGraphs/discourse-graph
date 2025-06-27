"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PlatformBadge } from "./PlatformBadge";

export function Logo() {
  let pathname = usePathname();

  const platform = pathname.includes("/docs/obsidian/") ? "obsidian" : "roam";

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
}
