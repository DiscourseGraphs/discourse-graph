const generateUid = (prefix = "dg") => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export default generateUid;
