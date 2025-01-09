import Link from "next/link";
import Image from "next/image";

export function Logo() {
  return (
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
  );
}
