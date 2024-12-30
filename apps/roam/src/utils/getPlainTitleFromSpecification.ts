import { Condition, QBClause } from "./types";

export const getPlainTitleFromSpecification = ({
  specification,
  text,
}: {
  specification: Condition[];
  text: string;
}) => {
  // Assumptions:
  // - Conditions are properly ordered
  // - There is a 'has title' condition somewhere
  const titleCondition = specification.find(
    (s): s is QBClause =>
      s.type === "clause" && s.relation === "has title" && s.source === text,
  );
  if (!titleCondition) return "";
  return titleCondition.target
    .replace(/^\/(\^)?/, "")
    .replace(/(\$)?\/$/, "")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\(\.[\*\+](\?)?\)/g, "");
};
