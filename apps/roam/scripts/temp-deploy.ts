if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const debugEnv = () => {
  console.log("Environment Variables Debug:");
  console.log({
    NODE_ENV: process.env.NODE_ENV,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN
      ? "Present"
      : "Missing",
    TOKEN_LENGTH: process.env.BLOB_READ_WRITE_TOKEN?.length,
    GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF,
    GITHUB_REF_NAME: process.env.GITHUB_REF_NAME,
    PWD: process.cwd(),
  });
};

if (require.main === module) {
  debugEnv();
}

export default debugEnv;
