import { DocsLayout } from "../components/DocsLayout";
import { navigation } from "./navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsLayout navigation={navigation}>{children}</DocsLayout>;
}
