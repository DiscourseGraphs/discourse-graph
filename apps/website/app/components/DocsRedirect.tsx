import { redirect, notFound } from "next/navigation";
import { NavigationList } from "~/components/Navigation";

export function DocsRedirect({ navigation }: { navigation: NavigationList }) {
  const firstSection = navigation[0];
  const firstLink = firstSection?.links[0];

  if (!firstLink?.href) {
    return notFound();
  }

  return redirect(firstLink.href);
}
