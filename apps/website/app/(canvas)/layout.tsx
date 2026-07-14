import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { Inter } from "next/font/google";
import "tldraw/tldraw.css";
import "~/globals.css";

export const metadata: Metadata = {
  title: "Canvas | Discourse Graphs",
  description:
    "A fast, collaborative canvas for mapping questions, claims, and evidence.",
};

const inter = Inter({ subsets: ["latin"] });

const CanvasLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <div className={`${inter.className} h-dvh overflow-hidden antialiased`}>
    {children}
  </div>
);

export default CanvasLayout;
