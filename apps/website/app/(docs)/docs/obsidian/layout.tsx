import { navigation } from "./navigation";
import { Layout } from "~/components/DocsLayout";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout navigationList={navigation}>{children}</Layout>;
}
