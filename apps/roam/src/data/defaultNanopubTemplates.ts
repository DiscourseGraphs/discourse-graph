import { NanopubConfig } from "../utils/getDiscourseNodes";

export const nodeTypes = {
  question: "https://w3id.org/kpxl/gen/terms/Question",
  claim: "https://w3id.org/kpxl/gen/terms/Claim",
  evidence: "https://w3id.org/kpxl/gen/terms/Evidence",
  source: "https://w3id.org/kpxl/gen/terms/Source",
};
export const requiresSource = {
  evidence: true,
};
export const defaultNanopubTemplate: NanopubConfig = {
  enabled: true,
  nodeType: "",
  useCustomBody: false,
  customBodyUid: "",
  requireContributors: true,
  requireSource: false,
  triples: [
    {
      uid: "",
      predicate: "is a",
      object: "{nodeType}",
      type: "assertion",
    },
    {
      uid: "",
      predicate: "has the label",
      object: "{title}",
      type: "assertion",
    },
    {
      uid: "",
      predicate: "has the description",
      object: "{body}",
      type: "assertion",
    },
    {
      uid: "",
      predicate: "has more info at",
      object: "{url}",
      type: "assertion",
    },
    {
      uid: "",
      predicate: "is attributed to",
      object: "{myORCID}",
      type: "provenance",
    },
    {
      uid: "",
      predicate: "is created by",
      object: "{createdBy}",
      type: "publication info",
    },
  ],
};
