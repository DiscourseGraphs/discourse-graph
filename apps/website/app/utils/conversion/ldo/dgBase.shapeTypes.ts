import type { ShapeType } from "@ldo/ldo";
import { dgBaseSchema } from "./dgBase.schema";
import { dgBaseContext } from "./dgBase.context";
import type {
  ContainerProfile,
  PersonAccountProfile,
  ItemProfile,
  NodeSchemaProfile,
  NodeInstanceProfile,
  AbstractRelationDefProfile,
  RelationDefProfile,
  RelationInstanceProfile,
  ContentProfile,
} from "./dgBase.typings";

/**
 * =============================================================================
 * LDO ShapeTypes dgBase
 * =============================================================================
 */

/**
 * ContainerProfile ShapeType
 */
export const ContainerProfileShapeType: ShapeType<ContainerProfile> = {
  schema: dgBaseSchema,
  shape: "https://discoursegraphs.com/schema/dg_base#ContainerProfile",
  context: dgBaseContext,
};

/**
 * PersonAccountProfile ShapeType
 */
export const PersonAccountProfileShapeType: ShapeType<PersonAccountProfile> = {
  schema: dgBaseSchema,
  shape: "https://discoursegraphs.com/schema/dg_base#PersonAccountProfile",
  context: dgBaseContext,
};

/**
 * ItemProfile ShapeType
 */
export const ItemProfileShapeType: ShapeType<ItemProfile> = {
  schema: dgBaseSchema,
  shape: "https://discoursegraphs.com/schema/dg_base#ItemProfile",
  context: dgBaseContext,
};

/**
 * NodeSchemaProfile ShapeType
 */
export const NodeSchemaProfileShapeType: ShapeType<NodeSchemaProfile> = {
  schema: dgBaseSchema,
  shape: "https://discoursegraphs.com/schema/dg_base#NodeSchemaProfile",
  context: dgBaseContext,
};

/**
 * NodeInstanceProfile ShapeType
 */
export const NodeInstanceProfileShapeType: ShapeType<NodeInstanceProfile> = {
  schema: dgBaseSchema,
  shape: "https://discoursegraphs.com/schema/dg_base#NodeInstanceProfile",
  context: dgBaseContext,
};

/**
 * AbstractRelationDefProfile ShapeType
 */
export const AbstractRelationDefProfileShapeType: ShapeType<AbstractRelationDefProfile> =
  {
    schema: dgBaseSchema,
    shape:
      "https://discoursegraphs.com/schema/dg_base#AbstractRelationDefProfile",
    context: dgBaseContext,
  };

/**
 * RelationDefProfile ShapeType
 */
export const RelationDefProfileShapeType: ShapeType<RelationDefProfile> = {
  schema: dgBaseSchema,
  shape: "https://discoursegraphs.com/schema/dg_base#RelationDefProfile",
  context: dgBaseContext,
};

/**
 * RelationInstanceProfile ShapeType
 */
export const RelationInstanceProfileShapeType: ShapeType<RelationInstanceProfile> =
  {
    schema: dgBaseSchema,
    shape: "https://discoursegraphs.com/schema/dg_base#RelationInstanceProfile",
    context: dgBaseContext,
  };

/**
 * ContentProfile ShapeType
 */
export const ContentProfileShapeType: ShapeType<ContentProfile> = {
  schema: dgBaseSchema,
  shape: "https://discoursegraphs.com/schema/dg_base#ContentProfile",
  context: dgBaseContext,
};
