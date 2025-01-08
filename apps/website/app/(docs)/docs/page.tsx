import Link from "next/link";
import Image from "next/image";

export default function DocsPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center lg:pl-72">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Future Home of All the Docs
        </h1>
        <p className="text-lg text-secondary">
          For now, here are the{" "}
          <Link href={"docs/roam"} className="underline">
            Roam Docs{" "}
          </Link>
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button>
            <Link href="https://github.com/DiscourseGraphs">
              <Image
                src="/github.svg"
                alt="GitHub"
                width={24}
                height={24}
                className="opacity-80 transition-opacity hover:opacity-100"
              />
            </Link>
          </button>
        </div>
      </div>
    </main>
  );
}
