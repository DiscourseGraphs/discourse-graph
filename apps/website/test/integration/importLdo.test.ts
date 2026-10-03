import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { parseRdf, toTurtle } from "@ldo/ldo";
import { toRDF } from "jsonld";
import {
  NodeSchemaProfileShapeType,
  NodeInstanceProfileShapeType,
  RelationInstanceProfileShapeType,
  RelationDefProfileShapeType,
  AbstractRelationDefProfileShapeType,
} from "../../app/utils/conversion/ldo/dgBase.shapeTypes";

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
  subClassOf: ["dgc:Claim", "mira:Claim"],
  label: "Claim",
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
  "@type": ["sdata:131157", "dgc:Claim", "mira:Claim"],
  modified: "2026-05-26T00:39:03.077Z",
  created: "2025-12-04T15:47:51.694Z",
  title: "CLM - Some base claim",
  description: {
    "@id": "page:content",
    format: "text/html",
    content:
      '<hr />\n<p>nodeTypeId: node<em>OHkZtsR6jkJIVaNmMY</em>GB\nnodeInstanceId: c1f02ff4-f116-452f-a490-3e0309667145</p>\n<h2 id="publishedtogroups">publishedToGroups:</h2>\n<p>That file was empty</p>',
  },
  creator: "someone",
};

const exAbstractRelnDef = {
  "@context": [
    "http://localhost:3000/schema/context.jsonld",
    {
      sdata: "http://localhost:3000/api/data/131102/",
      page: "http://localhost:3000/api/content/131102/131164#",
    },
  ],
  has_container: "http://localhost:3000/api/data/131102",
  "@id": "sdata:131164",
  "@type": "AbstractRelationDef",
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
  label: "supports",
  creator: "someone",
};

const exRelnType = {
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
  domain: "sdata:131157",
  range: "sdata:131157",
  subClassOf: [
    "dgb:RelationInstance",
    {
      "@type": "owl:Restriction",
      onProperty: "rdf:predicate",
      hasValue: "sdata:131169",
    },
  ],
  label: "supports",
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
  destination: "sdata:254918",
  title:
    "[[CLM - Some supporting claim]] -supports-> [[CLM - Some base claim]]",
  creator: "someone",
};

describe("LTO parsing of JSON-LD data", { tags: ["database"] }, () => {
  beforeAll(() => {});

  afterAll(() => {});

  const spaceUrl = "http://localhost:3000/api/data/131102";

  it("Reads a node schema", async () => {
    const id = exNodeSchema["@id"].split(":")[1];
    const entityUrl = `${spaceUrl}/${id}`;

    const asQuads = await toRDF(exNodeSchema, {
      format: "application/n-quads",
    });
    const ldoDataset = await parseRdf(asQuads, {
      baseIRI: entityUrl,
    });
    const parsedNodeSchema = ldoDataset
      .usingType(NodeSchemaProfileShapeType)
      .fromSubject(entityUrl);

    expect(parsedNodeSchema);
    expect(parsedNodeSchema["@id"]);
    expect(parsedNodeSchema.subClassOf);
    expect(parsedNodeSchema.created);
    expect(parsedNodeSchema.modified);
    expect(parsedNodeSchema.creator);
    expect(parsedNodeSchema.hasContainer);
    // const turtleData = await toTurtle(parsedNodeSchema);
    // console.log(turtleData);
  });

  it("Reads a node instance", async () => {
    const id = exNodeInstance["@id"];
    const entityUrl = `${spaceUrl}/${id}`;

    const asQuads = await toRDF(exNodeInstance, {
      format: "application/n-quads",
    });
    const ldoDataset = await parseRdf(asQuads, {
      baseIRI: entityUrl,
    });
    const parsedNodeInstance = ldoDataset
      .usingType(NodeInstanceProfileShapeType)
      .fromSubject(entityUrl);

    expect(parsedNodeInstance);
    expect(parsedNodeInstance["@id"]);
    expect(parsedNodeInstance.description);
    expect(parsedNodeInstance.created);
    expect(parsedNodeInstance.modified);
    expect(parsedNodeInstance.creator);
    expect(parsedNodeInstance.hasContainer);
    // const turtleData = await toTurtle(parsedNodeInstance);
    // console.log(turtleData);
  });

  it("Reads an abstract relation definition", async () => {
    const id = exAbstractRelnDef["@id"].split(":")[1];
    const entityUrl = `${spaceUrl}/${id}`;

    const asQuads = await toRDF(exAbstractRelnDef, {
      format: "application/n-quads",
    });
    const ldoDataset = await parseRdf(asQuads, {
      baseIRI: entityUrl,
    });
    const parsedRelnDef = ldoDataset
      .usingType(AbstractRelationDefProfileShapeType)
      .fromSubject(entityUrl);

    expect(parsedRelnDef);
    expect(parsedRelnDef["@id"]);
    expect(parsedRelnDef.label);
    expect(parsedRelnDef.created);
    expect(parsedRelnDef.modified);
    expect(parsedRelnDef.creator);
    expect(parsedRelnDef.hasContainer);
    // const turtleData = await toTurtle(parsedRelnSchema);
    // console.log(turtleData);
  });

  it("Reads a full relation definition", async () => {
    const id = exRelnType["@id"].split(":")[1];
    const entityUrl = `${spaceUrl}/${id}`;

    const asQuads = await toRDF(exRelnType, {
      format: "application/n-quads",
    });
    const ldoDataset = await parseRdf(asQuads, {
      baseIRI: entityUrl,
    });
    const parsedRelnSchema = ldoDataset
      .usingType(RelationDefProfileShapeType)
      .fromSubject(entityUrl);

    expect(parsedRelnSchema);
    expect(parsedRelnSchema["@id"]);
    expect(parsedRelnSchema.domain);
    expect(parsedRelnSchema.range);
    expect(parsedRelnSchema.created);
    expect(parsedRelnSchema.modified);
    expect(parsedRelnSchema.creator);
    expect(parsedRelnSchema.hasContainer);
    // const turtleData = await toTurtle(parsedRelnSchema);
    // console.log(turtleData);
  });

  it("Reads a relation instance", async () => {
    const id = exRelnInstance["@id"].split(":")[1];
    const entityUrl = `${spaceUrl}/${id}`;

    const asQuads = await toRDF(exRelnInstance, {
      format: "application/n-quads",
    });
    const ldoDataset = await parseRdf(asQuads, {
      baseIRI: entityUrl,
    });
    const parsedRelnInstance = ldoDataset
      .usingType(RelationInstanceProfileShapeType)
      .fromSubject(entityUrl);

    expect(parsedRelnInstance);
    expect(parsedRelnInstance["@id"]);
    expect(parsedRelnInstance.source);
    expect(parsedRelnInstance.destination);
    expect(parsedRelnInstance.created);
    expect(parsedRelnInstance.modified);
    expect(parsedRelnInstance.creator);
    expect(parsedRelnInstance.hasContainer);
    // const turtleData = await toTurtle(parsedRelnInstance);
    // console.log(turtleData);
  });
});
