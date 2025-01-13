import { redirect, notFound } from "next/navigation";
import { navigation } from "./navigation";

export default function Page() {
  const firstSection = navigation[0];
  const firstLink = firstSection?.links[0];

  if (!firstLink?.href) {
    notFound();
  }

  redirect(firstLink.href);
}
