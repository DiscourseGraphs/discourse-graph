import type { ReactElement, ReactNode } from "react";
import localFont from "next/font/local";
import "~/globals.css";

const geist = localFont({
  src: "../fonts/GeistVF.woff",
});

const PrototypeLayout = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => (
  <div className={`${geist.className} antialiased`}>{children}</div>
);

export default PrototypeLayout;
