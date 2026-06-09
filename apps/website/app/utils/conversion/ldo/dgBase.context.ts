import type { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * dgBaseContext: JSONLD Context for dgBase
 * =============================================================================
 */
export const dgBaseContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  Container: {
    "@id": "http://rdfs.org/sioc/ns#Container",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      containerOf: {
        "@id": "http://rdfs.org/sioc/ns#container_of",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  containerOf: {
    "@id": "http://rdfs.org/sioc/ns#container_of",
    "@type": "@id",
    "@isCollection": true,
  },
  Item: {
    "@id": "http://rdfs.org/sioc/ns#Item",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      hasContainer: {
        "@id": "http://rdfs.org/sioc/ns#has_container",
        "@type": "@id",
      },
      created: {
        "@id": "http://purl.org/dc/terms/created",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      modified: {
        "@id": "http://purl.org/dc/terms/modified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      creator: {
        "@id": "http://purl.org/dc/terms/creator",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  hasContainer: {
    "@id": "http://rdfs.org/sioc/ns#has_container",
    "@type": "@id",
  },
  created: {
    "@id": "http://purl.org/dc/terms/created",
    "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
  },
  modified: {
    "@id": "http://purl.org/dc/terms/modified",
    "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
  },
  creator: {
    "@id": "http://purl.org/dc/terms/creator",
    "@type": "@id",
    "@isCollection": true,
  },
  UserAccount: {
    "@id": "http://rdfs.org/sioc/ns#UserAccount",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      accountName: {
        "@id": "http://xmlns.com/foaf/0.1/accountName",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
    },
  },
  accountName: {
    "@id": "http://xmlns.com/foaf/0.1/accountName",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  NodeSchema: {
    "@id": "https://discoursegraphs.com/schema/dg_base#NodeSchema",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      hasContainer: {
        "@id": "http://rdfs.org/sioc/ns#has_container",
        "@type": "@id",
      },
      creator: {
        "@id": "http://purl.org/dc/terms/creator",
        "@type": "@id",
        "@isCollection": true,
      },
      created: {
        "@id": "http://purl.org/dc/terms/created",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      modified: {
        "@id": "http://purl.org/dc/terms/modified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      label: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#label",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      subClassOf: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  label: {
    "@id": "http://www.w3.org/2000/01/rdf-schema#label",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  subClassOf: {
    "@id": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
    "@type": "@id",
    "@isCollection": true,
  },
  NodeInstance: {
    "@id": "https://discoursegraphs.com/schema/dg_base#NodeInstance",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      hasContainer: {
        "@id": "http://rdfs.org/sioc/ns#has_container",
        "@type": "@id",
      },
      creator: {
        "@id": "http://purl.org/dc/terms/creator",
        "@type": "@id",
        "@isCollection": true,
      },
      created: {
        "@id": "http://purl.org/dc/terms/created",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      modified: {
        "@id": "http://purl.org/dc/terms/modified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      title: {
        "@id": "http://purl.org/dc/terms/title",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      description: {
        "@id": "http://purl.org/dc/terms/description",
        "@type": "@id",
      },
    },
  },
  title: {
    "@id": "http://purl.org/dc/terms/title",
    "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
  },
  description: {
    "@id": "http://purl.org/dc/terms/description",
    "@type": "@id",
  },
  Content: {
    "@id": "https://discoursegraphs.com/schema/dg_base#Content",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      format: {
        "@id": "http://purl.org/dc/terms/format",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      content: {
        "@id": "http://rdfs.org/sioc/ns#content",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
    },
  },
  format: {
    "@id": "http://purl.org/dc/terms/format",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  content: {
    "@id": "http://rdfs.org/sioc/ns#content",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  AbstractRelationDef: {
    "@id": "https://discoursegraphs.com/schema/dg_base#AbstractRelationDef",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      subClassOf: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
        "@type": "@id",
        "@isCollection": true,
      },
      hasContainer: {
        "@id": "http://rdfs.org/sioc/ns#has_container",
        "@type": "@id",
      },
      creator: {
        "@id": "http://purl.org/dc/terms/creator",
        "@type": "@id",
        "@isCollection": true,
      },
      created: {
        "@id": "http://purl.org/dc/terms/created",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      modified: {
        "@id": "http://purl.org/dc/terms/modified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      label: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#label",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
    },
  },
  RelationDef: {
    "@id": "https://discoursegraphs.com/schema/dg_base#RelationDef",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      subClassOf: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
        "@type": "@id",
        "@isCollection": true,
      },
      hasContainer: {
        "@id": "http://rdfs.org/sioc/ns#has_container",
        "@type": "@id",
      },
      creator: {
        "@id": "http://purl.org/dc/terms/creator",
        "@type": "@id",
        "@isCollection": true,
      },
      created: {
        "@id": "http://purl.org/dc/terms/created",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      modified: {
        "@id": "http://purl.org/dc/terms/modified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      label: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#label",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      domain: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#domain",
        "@type": "@id",
      },
      range: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#range",
        "@type": "@id",
      },
    },
  },
  domain: {
    "@id": "http://www.w3.org/2000/01/rdf-schema#domain",
    "@type": "@id",
  },
  range: {
    "@id": "http://www.w3.org/2000/01/rdf-schema#range",
    "@type": "@id",
  },
  RelationInstance: {
    "@id": "https://discoursegraphs.com/schema/dg_base#RelationInstance",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      hasContainer: {
        "@id": "http://rdfs.org/sioc/ns#has_container",
        "@type": "@id",
      },
      creator: {
        "@id": "http://purl.org/dc/terms/creator",
        "@type": "@id",
        "@isCollection": true,
      },
      created: {
        "@id": "http://purl.org/dc/terms/created",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      modified: {
        "@id": "http://purl.org/dc/terms/modified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      source: {
        "@id": "https://discoursegraphs.com/schema/dg_base#source",
        "@type": "@id",
      },
      destination: {
        "@id": "https://discoursegraphs.com/schema/dg_base#destination",
        "@type": "@id",
      },
    },
  },
  source: {
    "@id": "https://discoursegraphs.com/schema/dg_base#source",
    "@type": "@id",
  },
  destination: {
    "@id": "https://discoursegraphs.com/schema/dg_base#destination",
    "@type": "@id",
  },
};
