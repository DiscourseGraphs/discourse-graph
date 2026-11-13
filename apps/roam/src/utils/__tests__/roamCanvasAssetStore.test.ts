import { describe, expect, it, vi } from "vitest";
import {
  createRoamAssetStore,
  parseRoamUploadResponse,
} from "~/utils/roamCanvasAssetStore";

const setRoamAlphaAPI = (roamAlphaAPI: unknown): void => {
  (globalThis as { window: unknown }).window = { roamAlphaAPI };
};

const createUploadSpy = (urls: string[]) => {
  let call = 0;
  return vi.fn(() => Promise.resolve(urls[call++] ?? urls[urls.length - 1]));
};

const fakeFile = (name: string, type = "image/png"): File =>
  ({ name, type, size: 1024 }) as unknown as File;

describe("parseRoamUploadResponse", () => {
  it("unwraps the markdown image Roam returns from file.upload", () => {
    expect(
      parseRoamUploadResponse(
        "![](https://firebasestorage.googleapis.com/v0/b/x/o/imgs%2Fapp%2Fg%2Fa.png?alt=media)",
      ),
    ).toBe(
      "https://firebasestorage.googleapis.com/v0/b/x/o/imgs%2Fapp%2Fg%2Fa.png?alt=media",
    );
  });

  // Roam picks the wrapper by file type, not one wrapper for everything.
  // A video comes back as a {{[[video]]}} render component, and treating that
  // as an image left "{{[[video]]: " glued to the front of the url, which the
  // tldraw schema rejected and which crashed the whole canvas.
  it("unwraps the video render component Roam returns for a video", () => {
    expect(
      parseRoamUploadResponse(
        "{{[[video]]: https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fg%2Fo0geRItw_H.mp4?alt=media&token=c254db91-ec06-4519-b43d-1beeef402758}}",
      ),
    ).toBe(
      "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fg%2Fo0geRItw_H.mp4?alt=media&token=c254db91-ec06-4519-b43d-1beeef402758",
    );
  });

  it("unwraps the other render components Roam uses per file type", () => {
    expect(parseRoamUploadResponse("{{[[audio]]: https://x.test/a.mp3}}")).toBe(
      "https://x.test/a.mp3",
    );
    expect(parseRoamUploadResponse("{{[[pdf]]: https://x.test/a.pdf}}")).toBe(
      "https://x.test/a.pdf",
    );
    expect(parseRoamUploadResponse("[a.zip](https://x.test/a.zip)")).toBe(
      "https://x.test/a.zip",
    );
  });

  it("leaves a bare url untouched", () => {
    expect(parseRoamUploadResponse("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
  });
});

describe("createRoamAssetStore upload validation", () => {
  // A src that isn't a url fails tldraw's schema inside store.put, which is
  // outside the file handler's try/catch and takes the canvas down with an
  // error boundary. Fail here instead, where it becomes a toast.
  it("throws instead of returning a src the canvas schema will reject", async () => {
    setRoamAlphaAPI({
      file: { upload: () => Promise.resolve("upload failed: quota exceeded") },
    });

    await expect(
      createRoamAssetStore().upload({} as never, fakeFile("a.png")),
    ).rejects.toThrow(/could not find a url/i);
  });

  it("accepts the url out of any wrapper Roam used", async () => {
    setRoamAlphaAPI({
      file: {
        upload: () => Promise.resolve("{{[[video]]: https://x.test/a.mp4}}"),
      },
    });

    await expect(
      createRoamAssetStore().upload(
        {} as never,
        fakeFile("a.mp4", "video/mp4"),
      ),
    ).resolves.toBe("https://x.test/a.mp4");
  });
});

describe("createRoamAssetStore", () => {
  it("uploads a file to Roam and returns the bare url", async () => {
    const upload = createUploadSpy(["![](https://example.com/a.png)"]);
    setRoamAlphaAPI({ file: { upload } });

    const store = createRoamAssetStore();
    const file = fakeFile("a.png");

    await expect(store.upload({} as never, file)).resolves.toBe(
      "https://example.com/a.png",
    );
    expect(upload).toHaveBeenCalledWith({ file });
  });

  // ENG-2149: dropping several images at once must upload every one of them.
  // tldraw's default "files" content handler calls the asset store once per
  // file, so the store has to stay stateless and per-file.
  it("uploads every file of a multi-file drop to its own url", async () => {
    const upload = createUploadSpy([
      "![](https://example.com/a.png)",
      "![](https://example.com/b.png)",
      "![](https://example.com/c.png)",
    ]);
    setRoamAlphaAPI({ file: { upload } });

    const store = createRoamAssetStore();
    const files = [fakeFile("a.png"), fakeFile("b.png"), fakeFile("c.png")];

    const srcs = await Promise.all(
      files.map((file) => store.upload({} as never, file)),
    );

    expect(srcs).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.png",
      "https://example.com/c.png",
    ]);
    expect(upload).toHaveBeenCalledTimes(3);
  });

  it("resolves an asset to the url stored in its props", () => {
    const store = createRoamAssetStore();
    const asset = {
      props: { src: "https://example.com/a.png" },
    } as never;

    expect(store.resolve?.(asset, {} as never)).toBe(
      "https://example.com/a.png",
    );
  });
});
