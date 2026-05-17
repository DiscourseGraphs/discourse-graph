import type { Metadata } from "next";
import Script from "next/script";
import AdminShell from "./AdminShell";

const DECAP_CMS_SCRIPT_URL =
  "https://unpkg.com/decap-cms@3.8.3/dist/decap-cms.js";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Decap CMS",
};

const AdminPage = (): React.ReactElement => {
  return (
    <>
      <Script id="decap-manual-init" strategy="beforeInteractive">
        {`window.CMS_MANUAL_INIT = true;`}
      </Script>
      <Script src={DECAP_CMS_SCRIPT_URL} strategy="afterInteractive" />
      <AdminShell oauthBaseUrl={process.env.DECAP_OAUTH_BASE_URL ?? ""} />
    </>
  );
};

export default AdminPage;
