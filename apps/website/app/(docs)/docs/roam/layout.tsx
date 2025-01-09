import { Layout } from "~/components/DocsLayout";
import { navigation } from "./navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout navigationList={navigation}>{children}</Layout>;
}
