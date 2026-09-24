import {
  defaultShapeUtils,
  TextShapeUtil,
  TLAnyShapeUtilConstructor,
} from "tldraw";
import { TextShapeWithLinkUtil } from "./TextShapeWithLinkUtil";

// tldraw throws when a shape type is registered twice, so the stock text util
// has to be replaced rather than appended. Every store must use this same list.
export const baseShapeUtils: TLAnyShapeUtilConstructor[] =
  defaultShapeUtils.map((util) =>
    util === TextShapeUtil ? TextShapeWithLinkUtil : util,
  );

// Fail loudly rather than shipping a store whose schema lacks `url` while the
// UI still writes it, which would only surface as validation errors on save.
if (!baseShapeUtils.includes(TextShapeWithLinkUtil)) {
  throw new Error("Failed to replace TextShapeUtil in the default shape utils");
}
