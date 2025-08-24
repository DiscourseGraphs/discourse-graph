import nanoid from "nanoid";

const generateUid = (prefix = "dg") => {
  return `${prefix}_${nanoid()}`;
};

export default generateUid;
