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
    const safeFilename = path.basename(filename);
    const filePath = path.join(directory, safeFilename);
    const fileContent = await fs.readFile(filePath, "utf-8");
    return fileContent;
  } catch (error) {
    throw error instanceof Error
      ? new Error(`Failed to read file ${filename}: ${error.message}`, {
          cause: error,
        })
      : new Error(`Failed to read file ${filename}: Unknown error`);
  }
};
