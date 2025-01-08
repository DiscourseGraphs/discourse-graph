import path from "path";
import fs from "fs/promises";

type Props = {
  filename: string;
  directory: string;
};

export const getFileContent = async ({
  filename,
  directory,
}: Props): Promise<string> => {
  try {
    const filePath = path.join(directory, filename);
    const fileContent = await fs.readFile(filePath, "utf-8");
    return fileContent;
  } catch (error) {
    throw new Error(
      `Failed to read file ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};
