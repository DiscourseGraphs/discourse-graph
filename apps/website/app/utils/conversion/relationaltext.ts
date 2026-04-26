import { initRelationalText } from "relational-text";
import { from, to, registerFormat } from "relational-text/registry";
import type { LensSpec } from "relational-text/lens";

export const MIMETYPES: Record<string, string> = {
  obsidian: "text/x-obsidian",
  roam: "application/x-roam+json",
  html: "text/html",
};

const ALL_FORMATS = [
  {
    name: "obsidian",
    dir: "md.obsidian",
    lexicon: "obsidian.lexicon.json",
    wasm: "markdown.wasm.b64",
    lenses: ["obsidian-to-relationaltext.lens.json"],
  },
  {
    name: "html",
    dir: "org.w3c.html",
    lexicon: "whatwg-html.lexicon.json",
    wasm: "html.wasm.b64",
    lenses: [
      "html-to-relationaltext.lens.json",
      "relationaltext-to-html.lens.json",
    ],
  },
  {
    name: "roam",
    dir: "com.roamresearch",
    lexicon: "roam.lexicon.json",
    wasm: "roam.wasm.b64",
    lenses: ["roam-to-relationaltext.lens.json"],
  },
];

const fetchText = async (path: string): Promise<string> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.text();
};

const fetchJson = async (path: string): Promise<Record<string, unknown>> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
};

let inited = false;

export const initRT = async (baseUrl: string) => {
  if (inited) return;
  await initRelationalText();
  await Promise.all(
    ALL_FORMATS.map(async (def) => {
      const base = `${baseUrl}/formats/${def.dir}`;

      // Fetch lexicon, WASM (if present), and all lenses in parallel
      const fetches: Promise<unknown>[] = [fetchJson(`${base}/${def.lexicon}`)];
      if (def.wasm) {
        fetches.push(fetchText(`${base}/${def.wasm}`));
      }
      for (const lens of def.lenses) {
        fetches.push(fetchJson(`${base}/${lens}`));
      }

      const results = await Promise.all(fetches);

      let idx = 0;
      const lexicon = results[idx++] as Record<string, unknown>;
      const wasmData = def.wasm ? (results[idx++] as string).trim() : undefined;
      const lenses = def.lenses.map(() => results[idx++] as LensSpec);

      registerFormat(def.name, lexicon, {
        wasmData,
        lenses,
        // aliases: def.aliases,
      });
    }),
  );
  inited = true;
};

export const convert = async (
  txt: string,
  source: string,
  dest: string,
): Promise<string> => {
  const doc = await from(source, txt);
  return await to(dest, doc);
};
