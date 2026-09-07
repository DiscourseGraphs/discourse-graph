import type { Metadata } from "next";
import { PRODUCTION_SITE_URL } from "./seo";
import { JsonLd } from "~/components/JsonLd";
import { DESCRIPTION } from "~/data/constants";
import { createSiteStructuredData } from "~/utils/structuredData";

type RootLayoutProps = {
  children: React.ReactNode;
};

export const metadata: Metadata = {
  metadataBase: PRODUCTION_SITE_URL,
};

const RootLayout = ({ children }: RootLayoutProps): React.ReactElement => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <JsonLd data={createSiteStructuredData({ description: DESCRIPTION })} />
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
