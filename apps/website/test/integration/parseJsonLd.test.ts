import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type {
  ContainerProfile,
  NodeSchemaProfile,
  NodeInstanceProfile,
  RelationInstanceProfile,
  RelationTripleDefProfile,
  RelationDefProfile,
} from "../../app/utils/conversion/ldo/dgBase.typings";
import { parseJsonLd } from "../../app/utils/conversion/fromJsonLd";

// example data

const exNodeSchema = {
  "@context": [
    "http://localhost:3000/schema/context.jsonld",
    {
      sdata: "http://localhost:3000/api/data/131102/",
      page: "http://localhost:3000/api/content/131102/131157#",
    },
  ],
  has_container: "http://localhost:3000/api/data/131102",
  "@id": "sdata:131157",
  "@type": "NodeSchema",
  modified: "2026-01-24T15:38:14.553Z",
  created: "2026-01-24T15:38:14.553Z",
  subClassOf: ["dgc:Question", "mira:Question"],
  label: "Question",
  creator: "someone",
};

const exNodeInstance = {
  "@context": [
    "http://localhost:3000/schema/context.jsonld",
    {
      sdata: "http://localhost:3000/api/data/131102/",
      page: "http://localhost:3000/api/content/131102/254918#",
    },
  ],
  has_container: "http://localhost:3000/api/data/131102",
  "@id": "sdata:254918",
  "@type": ["sdata:131157", "dgc:Question", "mira:Question"],
  modified: "2026-05-26T00:39:03.077Z",
  created: "2025-12-04T15:47:51.694Z",
  title: "QUE - How to do interop",
  description: {
    "@id": "page:content",
    format: "text/html",
    content:
      '<hr />\n<p>nodeTypeId: node<em>OHkZtsR6jkJIVaNmMY</em>GB\nnodeInstanceId: c1f02ff4-f116-452f-a490-3e0309667145</p>\n<h2 id="publishedtogroups">publishedToGroups:</h2>\n<p>That file was empty</p>',
  },
  creator: "someone",
};

const exRelnDef = {
  "@context": [
    "http://localhost:3000/schema/context.jsonld",
    {
      sdata: "http://localhost:3000/api/data/131102/",
      page: "http://localhost:3000/api/content/131102/131164#",
    },
  ],
  has_container: "http://localhost:3000/api/data/131102",
  "@id": "sdata:131164",
  "@type": "RelationDef",
  modified: "2026-01-24T15:38:14.553Z",
  created: "2026-01-24T15:38:14.553Z",
  subClassOf: [
    "dgb:RelationInstance",
    {
      "@type": "owl:Restriction",
      onProperty: "rdf:predicate",
      hasValue: "sdata:131164",
    },
  ],
  label: "informs",
  creator: "someone",
};

const exRelnTripleType = {
  "@context": [
    "http://localhost:3000/schema/context.jsonld",
    {
      sdata: "http://localhost:3000/api/data/131102/",
      page: "http://localhost:3000/api/content/131102/131169#",
    },
  ],
  has_container: "http://localhost:3000/api/data/131102",
  "@id": "sdata:131169",
  "@type": "RelationDef",
  modified: "2026-01-24T15:38:14.553Z",
  created: "2026-01-24T15:38:14.553Z",
  subClassOf: [
    "dgb:RelationInstance",
    {
      "@type": "owl:Restriction",
      onProperty: "rdf:predicate",
      hasValue: "sdata:131169",
    },
  ],
  label: "Claim -informs-> Question",
  creator: "someone",
};

const exRelnInstance = {
  "@context": [
    "http://localhost:3000/schema/context.jsonld",
    {
      sdata: "http://localhost:3000/api/data/131102/",
      page: "http://localhost:3000/api/content/131102/261147#",
    },
  ],
  has_container: "http://localhost:3000/api/data/131102",
  "@id": "sdata:261147",
  "@type": "sdata:131164",
  modified: "2026-06-03T10:13:09.101Z",
  created: "2026-06-03T10:13:09.101Z",
  source: "sdata:261134",
  destination: "sdata:261140",
  title:
    "[[CLM - New claim for sharing]] -informs-> [[QUE - This is a test question]]",
  creator: "someone",
};

describe("LTO parsing of JSON-LD data", { tags: ["database"] }, () => {
  beforeAll(() => {});

  afterAll(() => {});

  const spaceUrl = "http://localhost:3000/api/data/131102";

  it("Reads a node schema", async () => {
    const data = exNodeSchema;
    const id = data["@id"];
    const url = `${spaceUrl}/${id.split(":")[1]}`;
    const parsedData = await parseJsonLd(data, url);
    const parsedItem = parsedData.filter(
      (item) => item["@id"] === url,
    )[0] as NodeSchemaProfile;
    const types = parsedItem.type.toArray().map((x) => x["@id"]);
    expect(types.includes("NodeSchema"));
    // TODO: Find a way to verify that it was indeed parsed as NodeSchema
    expect(parsedItem);
    expect(parsedItem["@id"]);
    expect(parsedItem.subClassOf);
    expect(parsedItem.date);
    expect(parsedItem.modified);
    expect(parsedItem.creator);
    expect(parsedItem.hasContainer);
    // const turtleData = await toTurtle(parsedNodeSchema);
    // console.log(turtleData);
  });

  it("Reads a node instance", async () => {
    const data = exNodeInstance;
    const id = data["@id"];
    const url = `${spaceUrl}/${id.split(":")[1]}`;
    const parsedData = await parseJsonLd(data, url);
    const parsedItem = parsedData.filter(
      (item) => item["@id"] === url,
    )[0] as NodeInstanceProfile;
    // TODO: Find a way to verify that it was indeed parsed as NodeInstance.
    const types = parsedItem.type.toArray().map((x) => x["@id"]);
    expect(types.includes("NodeInstance"));
    expect(parsedItem);
    expect(parsedItem["@id"]);
    expect(parsedItem.title);
    expect(parsedItem.description);
    expect(parsedItem.date);
    expect(parsedItem.modified);
    expect(parsedItem.creator);
    expect(parsedItem.hasContainer);
    // const turtleData = await toTurtle(parsedNodeInstance);
    // console.log(turtleData);
  });

  it("Reads a relation definition", async () => {
    const data = exRelnDef;
    const id = data["@id"];
    const url = `${spaceUrl}/${id.split(":")[1]}`;
    const parsedData = await parseJsonLd(data, url);
    const parsedItem = parsedData.filter(
      (item) => item["@id"] === url,
    )[0] as RelationDefProfile;
    const types = parsedItem.type.toArray().map((x) => x["@id"]);
    expect(types.includes("RelationDef"));

    expect(parsedItem);
    expect(parsedItem["@id"]);
    expect(parsedItem.label);
    expect(parsedItem.date);
    expect(parsedItem.modified);
    expect(parsedItem.creator);
    expect(parsedItem.hasContainer);
    // const turtleData = await toTurtle(parsedRelnSchema);
    // console.log(turtleData);
  });

  it("Reads a relation triple definition", async () => {
    const data = exRelnTripleType;
    const id = data["@id"];
    const url = `${spaceUrl}/${id.split(":")[1]}`;
    const parsedData = await parseJsonLd(data, url);
    const parsedItem = parsedData.filter(
      (item) => item["@id"] === url,
    )[0] as RelationTripleDefProfile;
    const types = parsedItem.type.toArray().map((x) => x["@id"]);
    expect(types.includes("RelationTripleDef"));
    expect(parsedItem);
    expect(parsedItem["@id"]);
    expect(parsedItem.domain);
    expect(parsedItem.range);
    expect(parsedItem.date);
    expect(parsedItem.modified);
    expect(parsedItem.creator);
    expect(parsedItem.hasContainer);
    // const turtleData = await toTurtle(parsedRelnSchema);
    // console.log(turtleData);
  });

  it("Reads a relation instance", async () => {
    const data = exRelnInstance;
    const id = data["@id"];
    const url = `${spaceUrl}/${id.split(":")[1]}`;
    const parsedData = await parseJsonLd(data, url);
    const parsedItem = parsedData.filter(
      (item) => item["@id"] === url,
    )[0] as RelationInstanceProfile;
    const types = parsedItem.type.toArray().map((x) => x["@id"]);
    expect(types.includes("RelationInstance"));
    expect(parsedItem);
    expect(parsedItem["@id"]);
    expect(parsedItem.source);
    expect(parsedItem.destination);
    expect(parsedItem.date);
    expect(parsedItem.modified);
    expect(parsedItem.creator);
    expect(parsedItem.hasContainer);
    // const turtleData = await toTurtle(parsedRelnInstance);
    // console.log(turtleData);
  });
});
