import { Layout } from "~/components/DocsLayout";
import { NavigationList } from "~/components/Navigation";

type DocsLayoutProps = {
  children: React.ReactNode;
  navigation: NavigationList;
};

export function DocsLayout({ children, navigation }: DocsLayoutProps) {
  return <Layout navigationList={navigation}>{children}</Layout>;
}
