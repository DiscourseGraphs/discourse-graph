import { JsonLd } from "~/components/JsonLd";
import { DESCRIPTION } from "~/data/constants";
import { createSiteStructuredData } from "~/utils/structuredData";

type RootLayoutProps = {
  children: React.ReactNode;
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
