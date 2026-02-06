/* eslint-disable @typescript-eslint/naming-convention */ // This is for nodePosition keys
import type { DiscourseRelationSettings } from "~/components/settings/utils/zodSchema";

// TODO: Delete the original default relations in data/defaultRelations.ts when fully migrated.
const DEFAULT_RELATIONS_BLOCK_PROPS: Record<string, DiscourseRelationSettings> =
  {
    "_INFO-rel": {
      label: "Informs",
      source: "_EVD-node",
      destination: "_QUE-node",
      complement: "Informed By",
      ifConditions: [
        {
          triples: [
            ["Page", "is a", "source"],
            ["Block", "references", "Page"],
            ["Block", "is in page", "ParentPage"],
            ["ParentPage", "is a", "destination"],
          ],
          nodePositions: {
            "0": "100 57",
            "1": "100 208",
            "2": "100 345",
            source: "281 57",
            destination: "281 345",
          },
        },
      ],
    },
    "_SUPP-rel": {
      label: "Supports",
      source: "_EVD-node",
      destination: "_CLM-node",
      complement: "Supported By",
      ifConditions: [
        {
          triples: [
            ["Page", "is a", "source"],
            ["Block", "references", "Page"],
            ["SBlock", "references", "SPage"],
            ["SPage", "has title", "SupportedBy"],
            ["SBlock", "has child", "Block"],
            ["PBlock", "references", "ParentPage"],
            ["PBlock", "has child", "SBlock"],
            ["ParentPage", "is a", "destination"],
          ],
          nodePositions: {
            "0": "250 325",
            "1": "100 325",
            "2": "100 200",
            "3": "250 200",
            "4": "400 200",
            "5": "100 75",
            "6": "250 75",
            source: "400 325",
            destination: "400 75",
          },
        },
        {
          triples: [
            ["Page", "is a", "destination"],
            ["Block", "references", "Page"],
            ["SBlock", "references", "SPage"],
            ["SPage", "has title", "Supports"],
            ["SBlock", "has child", "Block"],
            ["PBlock", "references", "ParentPage"],
            ["PBlock", "has child", "SBlock"],
            ["ParentPage", "is a", "source"],
          ],
          nodePositions: {
            "7": "250 325",
            "8": "100 325",
            "9": "100 200",
            "10": "250 200",
            "11": "400 200",
            "12": "100 75",
            "13": "250 75",
            source: "400 75",
            destination: "400 325",
          },
        },
      ],
    },
    "_OPPO-rel": {
      label: "Opposes",
      source: "_EVD-node",
      destination: "_CLM-node",
      complement: "Opposed By",
      ifConditions: [
        {
          triples: [
            ["Page", "is a", "source"],
            ["Block", "references", "Page"],
            ["SBlock", "references", "SPage"],
            ["SPage", "has title", "OpposedBy"],
            ["SBlock", "has child", "Block"],
            ["PBlock", "references", "ParentPage"],
            ["PBlock", "has child", "SBlock"],
            ["ParentPage", "is a", "destination"],
          ],
          nodePositions: {
            "0": "250 325",
            "1": "100 325",
            "2": "100 200",
            "3": "250 200",
            "4": "400 200",
            "5": "100 75",
            "6": "250 75",
            source: "400 325",
            destination: "400 75",
          },
        },
        {
          triples: [
            ["Page", "is a", "destination"],
            ["Block", "references", "Page"],
            ["SBlock", "references", "SPage"],
            ["SPage", "has title", "Opposes"],
            ["SBlock", "has child", "Block"],
            ["PBlock", "references", "ParentPage"],
            ["PBlock", "has child", "SBlock"],
            ["ParentPage", "is a", "source"],
          ],
          nodePositions: {
            "7": "250 325",
            "8": "100 325",
            "9": "100 200",
            "10": "250 200",
            "11": "400 200",
            "12": "100 75",
            "13": "250 75",
            source: "400 75",
            destination: "400 325",
          },
        },
      ],
    },
  };

export default DEFAULT_RELATIONS_BLOCK_PROPS;
