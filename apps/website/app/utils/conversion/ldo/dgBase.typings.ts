import type { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for dgBase
 * =============================================================================
 */

/**
 * ContainerProfile Type
 */
export interface ContainerProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "Container";
  }>;
  containerOf?: LdSet<ItemProfile>;
}

/**
 * ItemProfile Type
 */
export interface ItemProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "Item";
  }>;
  hasContainer?: {
    "@id": string;
  };
  created?: string;
  modified?: string;
  creator?: string;
}

/**
 * NodeSchemaProfile Type
 */
export interface NodeSchemaProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "NodeSchema";
  }>;
  hasContainer?: {
    "@id": string;
  };
  creator?: string;
  created?: string;
  modified?: string;
  label: string;
  subClassOf?: LdSet<{
    "@id": string;
  }>;
}

/**
 * NodeInstanceProfile Type
 */
export interface NodeInstanceProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "NodeInstance";
  }>;
  hasContainer?: {
    "@id": string;
  };
  creator?: string;
  created?: string;
  modified?: string;
  title?: string;
  description?: ContentProfile;
}

/**
 * AbstractRelationDefProfile Type
 */
export interface AbstractRelationDefProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "AbstractRelationDef";
  }>;
  subClassOf?: LdSet<{
    "@id": string;
  }>;
  hasContainer?: {
    "@id": string;
  };
  creator?: string;
  created?: string;
  modified?: string;
  label: string;
}

/**
 * RelationDefProfile Type
 */
export interface RelationDefProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "RelationDef";
  }>;
  subClassOf?: LdSet<{
    "@id": string;
  }>;
  hasContainer?: {
    "@id": string;
  };
  creator?: string;
  created?: string;
  modified?: string;
  label: string;
  domain: {
    "@id": string;
  };
  range: {
    "@id": string;
  };
}

/**
 * RelationInstanceProfile Type
 */
export interface RelationInstanceProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "RelationInstance";
  }>;
  hasContainer?: {
    "@id": string;
  };
  creator?: string;
  created?: string;
  modified?: string;
  source: NodeInstanceProfile;
  destination: NodeInstanceProfile;
}

/**
 * ContentProfile Type
 */
export interface ContentProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "Content";
  }>;
  format?: string;
  content: string;
}
