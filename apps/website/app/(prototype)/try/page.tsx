import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DiscourseGraphPrototype } from "./DiscourseGraphPrototype";

export const metadata: Metadata = {
  title: "Try a Discourse Graph",
  description:
    "Explore a small, interactive graph of questions, claims, evidence, and sources.",
};

const TryDiscourseGraphPage = (): ReactElement => <DiscourseGraphPrototype />;

export default TryDiscourseGraphPage;
