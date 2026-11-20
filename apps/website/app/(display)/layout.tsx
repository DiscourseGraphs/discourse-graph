import "~/globals.css";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

type DisplayLayoutProps = {
  children: React.ReactNode;
};

const DisplayLayout = ({
  children,
}: DisplayLayoutProps): React.ReactElement => {
  return (
    <div className={`${inter.className} min-h-screen bg-slate-50 antialiased`}>
      <header className="border-b border-slate-200 bg-white px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Image
            src="/logo-screenshot-48.png"
            alt="Discourse Graphs Logo"
            width={26}
            height={26}
          />
          <span className="text-[16px] font-semibold text-slate-900">
            Discourse Graphs
          </span>
        </Link>
      </header>
      {children}
    </div>
  );
};

export default DisplayLayout;
