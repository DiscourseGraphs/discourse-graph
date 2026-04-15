import getDiscourseRelations from "./getDiscourseRelations";
import type { SettingsSnapshot } from "~/components/settings/utils/accessors";

const getDiscourseRelationLabels = (
  relations?: ReturnType<typeof getDiscourseRelations>,
  snapshot?: SettingsSnapshot,
) =>
  Array.from(
    new Set(
      (relations ?? getDiscourseRelations(snapshot)).flatMap((r) => [
        r.label,
        r.complement,
      ]),
    ),
  ).filter((s) => !!s);

export default getDiscourseRelationLabels;
