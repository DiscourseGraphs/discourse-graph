"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlatformBadge } from "./PlatformBadge";

const DOCS_PLATFORMS = {
  "/docs/obsidian": "obsidian",
  "/docs/roam": "roam",
} as const;

type LogoProps = {
  linked?: boolean;
  textClassName?: string;
};

export const Logo = ({
  linked = true,
  textClassName = "text-neutral-dark",
}: LogoProps) => {
  const pathname = usePathname();

  const platform = Object.entries(DOCS_PLATFORMS).find(([path]) =>
    pathname.includes(path),
  )?.[1];

  const brand = (
    <>
      <span
        aria-hidden="true"
        className={`block h-12 w-12 shrink-0 bg-current ${textClassName}`}
        style={{
          WebkitMaskImage: "url('/logo-light-48.svg')",
          maskImage: "url('/logo-light-48.svg')",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />

      <span className={`text-3xl font-bold ${textClassName}`}>
        Discourse Graphs
      </span>
    </>
  );

  return (
    <div className="flex items-center space-x-2">
      {linked ? (
        <Link href="/" className="flex items-center space-x-2">
          {brand}
        </Link>
      ) : (
        <div className="flex items-center space-x-2">{brand}</div>
      )}
      {platform && (
        <div className="">
          <PlatformBadge platform={platform} />
        </div>
      )}
    </div>
  );
};
