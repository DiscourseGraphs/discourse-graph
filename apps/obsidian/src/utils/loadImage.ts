/**
 * Load an image and return its natural dimensions.
 * Supports both vault resource paths (app://...) and external URLs (https://...).
 * 
 * Note: This works with Obsidian's resource paths returned by app.vault.getResourcePath()
 * which are special app:// protocol URLs handled by Obsidian's Electron environment.
 */
export const loadImage = (
  url: string,
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Failed to load image: timeout"));
      }
    }, 10000);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };

    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(new Error("Failed to load image"));
      }
    };

    img.src = url;
  });
};

