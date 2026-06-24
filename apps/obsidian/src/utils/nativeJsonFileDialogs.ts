type SaveDialogResult = {
  canceled: boolean;
  filePath?: string;
};

type OpenDialogResult = {
  canceled: boolean;
  filePaths: string[];
};

type ElectronDialog = {
  showSaveDialog?: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<SaveDialogResult>;
  showOpenDialog?: (options: {
    title: string;
    properties: string[];
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<OpenDialogResult>;
};

type ElectronLike = {
  dialog?: ElectronDialog;
  remote?: {
    dialog?: ElectronDialog;
  };
};

type FsPromisesLike = {
  readFile: (path: string, encoding: string) => Promise<string>;
  writeFile: (path: string, data: string, encoding: string) => Promise<void>;
};

type SaveFilePickerHandle = {
  name: string;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type OpenFilePickerHandle = {
  getFile: () => Promise<File>;
};

type BrowserWindowWithPickers = Window & {
  require?: (name: string) => unknown;
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<SaveFilePickerHandle>;
  showOpenFilePicker?: (options: {
    multiple: boolean;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<OpenFilePickerHandle[]>;
};

export class NativeFileDialogCancelledError extends Error {
  constructor() {
    super("File dialog cancelled");
    this.name = "NativeFileDialogCancelledError";
  }
}

const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === "AbortError";
};

const getBrowserWindow = (): BrowserWindowWithPickers | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window as BrowserWindowWithPickers;
};

const getFsPromises = (value: unknown): FsPromisesLike => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("readFile" in value) ||
    !("writeFile" in value) ||
    typeof (value as { readFile: unknown }).readFile !== "function" ||
    typeof (value as { writeFile: unknown }).writeFile !== "function"
  ) {
    throw new Error("Unable to access filesystem read/write APIs.");
  }
  return value as FsPromisesLike;
};

const getElectronDialog = (value: unknown): ElectronDialog | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const electronLike = value as ElectronLike;
  const directDialog = electronLike.dialog;
  if (directDialog) {
    return directDialog;
  }
  const remoteDialog = electronLike.remote?.dialog;
  if (remoteDialog) {
    return remoteDialog;
  }
  return null;
};

const saveWithFileSystemAccessApi = async ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): Promise<string | null> => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow?.showSaveFilePicker) {
    return null;
  }
  try {
    const fileHandle = await browserWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "JSON files",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return fileHandle.name;
  } catch (error) {
    if (isAbortError(error)) {
      throw new NativeFileDialogCancelledError();
    }
    throw error;
  }
};

const saveWithElectronDialog = async ({
  fileName,
  content,
  title,
}: {
  fileName: string;
  content: string;
  title: string;
}): Promise<string | null> => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow?.require) {
    return null;
  }
  const electron = browserWindow.require("electron");
  const dialog = getElectronDialog(electron);
  if (!dialog?.showSaveDialog) {
    return null;
  }
  const result = await dialog.showSaveDialog({
    title,
    defaultPath: fileName,
    filters: [{ name: "JSON files", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) {
    throw new NativeFileDialogCancelledError();
  }
  const fsPromises = getFsPromises(browserWindow.require("fs/promises"));
  await fsPromises.writeFile(result.filePath, content, "utf8");
  return result.filePath;
};

const triggerBrowserDownload = ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): string => {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return fileName;
};

const openWithFileSystemAccessApi = async (): Promise<{
  content: string;
  sourcePath: string;
} | null> => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow?.showOpenFilePicker) {
    return null;
  }
  try {
    const [fileHandle] = await browserWindow.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "JSON files",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    if (!fileHandle) {
      throw new NativeFileDialogCancelledError();
    }
    const file = await fileHandle.getFile();
    return {
      content: await file.text(),
      sourcePath: file.name,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw new NativeFileDialogCancelledError();
    }
    throw error;
  }
};

const openWithElectronDialog = async ({
  title,
}: {
  title: string;
}): Promise<{ content: string; sourcePath: string } | null> => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow?.require) {
    return null;
  }
  const electron = browserWindow.require("electron");
  const dialog = getElectronDialog(electron);
  if (!dialog?.showOpenDialog) {
    return null;
  }
  const result = await dialog.showOpenDialog({
    title,
    properties: ["openFile"],
    filters: [{ name: "JSON files", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths[0]) {
    throw new NativeFileDialogCancelledError();
  }
  const fsPromises = getFsPromises(browserWindow.require("fs/promises"));
  const sourcePath = result.filePaths[0];
  const content = await fsPromises.readFile(sourcePath, "utf8");
  return { content, sourcePath };
};

export const saveJsonToUserLocation = async ({
  title,
  fileName,
  content,
}: {
  title: string;
  fileName: string;
  content: string;
}): Promise<string> => {
  const pathFromFsApi = await saveWithFileSystemAccessApi({
    fileName,
    content,
  });
  if (pathFromFsApi) {
    return pathFromFsApi;
  }
  const pathFromElectron = await saveWithElectronDialog({
    title,
    fileName,
    content,
  });
  if (pathFromElectron) {
    return pathFromElectron;
  }
  return triggerBrowserDownload({ fileName, content });
};

export const openJsonFromUserLocation = async ({
  title,
}: {
  title: string;
}): Promise<{ content: string; sourcePath: string }> => {
  const fromFsApi = await openWithFileSystemAccessApi();
  if (fromFsApi) {
    return fromFsApi;
  }
  const fromElectron = await openWithElectronDialog({ title });
  if (fromElectron) {
    return fromElectron;
  }
  throw new Error(
    "Schema import requires a file picker. Your environment does not expose one.",
  );
};
