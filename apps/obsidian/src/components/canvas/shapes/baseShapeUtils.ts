import {
  defaultShapeUtils,
  TextShapeUtil,
  TLAnyShapeUtilConstructor,
} from "tldraw";
import { TextShapeWithLinkUtil } from "~/components/canvas/shapes/TextShapeWithLinkUtil";

// tldraw throws when a shape type is registered twice, so the stock text util
// has to be replaced rather than appended. Every store must use this same list:
// the schema and the editor are built from separate arrays and nothing asserts
// they agree.
export const baseShapeUtils: TLAnyShapeUtilConstructor[] =
  defaultShapeUtils.map((util) =>
    util === TextShapeUtil ? TextShapeWithLinkUtil : util,
  );
