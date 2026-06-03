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
  hasContainer?: ContainerProfile;
  date?: string;
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
  hasContainer?: ContainerProfile;
  creator?: string;
  date?: string;
  modified?: string;
  label: string;
  subClassOf?: LdSet<NodeSchemaProfile>;
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
  hasContainer?: ContainerProfile;
  creator?: string;
  date?: string;
  modified?: string;
  title?: string;
  description?: ContentProfile;
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
  subClassOf:
    | {
        "@id": "Item";
      }
    | {
        "@id": "ObjectProperty";
      }
    | {
        "@id": "RelationInstance";
      };
  hasContainer?: ContainerProfile;
  creator?: string;
  date?: string;
  modified?: string;
  label: string;
}

/**
 * RelationTripleDefProfile Type
 */
export interface RelationTripleDefProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "RelationTripleDef";
  }>;
  subClassOf:
    | {
        "@id": "ObjectProperty";
      }
    | {
        "@id": "RelationInstance";
      };
  hasContainer?: ContainerProfile;
  creator?: string;
  date?: string;
  modified?: string;
  domain: NodeSchemaProfile;
  range: NodeSchemaProfile;
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
  hasContainer?: ContainerProfile;
  creator?: string;
  date?: string;
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
