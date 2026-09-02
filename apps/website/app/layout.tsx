import type { Metadata } from "next";
import { PRODUCTION_SITE_URL } from "./seo";

type RootLayoutProps = {
  children: React.ReactNode;
};

export const metadata: Metadata = {
  metadataBase: PRODUCTION_SITE_URL,
};

const RootLayout = ({ children }: RootLayoutProps): React.ReactElement => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
