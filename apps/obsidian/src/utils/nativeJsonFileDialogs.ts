type SaveDialogResult = {
  canceled: boolean;
  filePath?: string;
};

type OpenDialogResult = {
  canceled: boolean;
  filePaths: string[];
};

type ElectronDialog = {
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<SaveDialogResult>;
  showOpenDialog: (options: {
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

type ElectronWindow = Window & {
  require: (name: string) => unknown;
};

export class NativeFileDialogCancelledError extends Error {
  constructor() {
    super("File dialog cancelled");
    this.name = "NativeFileDialogCancelledError";
  }
}

const getElectronWindow = (): ElectronWindow => {
  if (typeof window === "undefined" || !("require" in window)) {
    throw new Error(
      "Schema export/import requires Obsidian desktop (Electron).",
    );
  }
  return window as ElectronWindow;
};

const getFsPromises = (electronWindow: ElectronWindow): FsPromisesLike => {
  const fsPromises = electronWindow.require("fs/promises");
  if (
    typeof fsPromises !== "object" ||
    fsPromises === null ||
    !("readFile" in fsPromises) ||
    !("writeFile" in fsPromises)
  ) {
    throw new Error("Unable to access filesystem read/write APIs.");
  }
  return fsPromises as FsPromisesLike;
};

const getElectronDialog = (electronWindow: ElectronWindow): ElectronDialog => {
  const electron = electronWindow.require("electron") as ElectronLike;
  const dialog = electron.dialog ?? electron.remote?.dialog;
  if (!dialog?.showSaveDialog || !dialog.showOpenDialog) {
    throw new Error("Unable to access Electron file dialogs.");
  }
  return dialog;
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
  const electronWindow = getElectronWindow();
  const dialog = getElectronDialog(electronWindow);
  const result = await dialog.showSaveDialog({
    title,
    defaultPath: fileName,
    filters: [{ name: "JSON files", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) {
    throw new NativeFileDialogCancelledError();
  }
  const fsPromises = getFsPromises(electronWindow);
  await fsPromises.writeFile(result.filePath, content, "utf8");
  return result.filePath;
};

export const openJsonFromUserLocation = async ({
  title,
}: {
  title: string;
}): Promise<{ content: string; sourcePath: string }> => {
  const electronWindow = getElectronWindow();
  const dialog = getElectronDialog(electronWindow);
  const result = await dialog.showOpenDialog({
    title,
    properties: ["openFile"],
    filters: [{ name: "JSON files", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths[0]) {
    throw new NativeFileDialogCancelledError();
  }
  const fsPromises = getFsPromises(electronWindow);
  const sourcePath = result.filePaths[0];
  const content = await fsPromises.readFile(sourcePath, "utf8");
  return { content, sourcePath };
};
