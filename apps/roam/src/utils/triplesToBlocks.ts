import type { InputTextNode } from "roamjs-components/types";
import { Condition } from "./types";

// TODO - this needs to be massively reworked to incorporate inverse functions on the conditionToDatalog mapping itself
// similar to `update` on defaultSelections.ts. Something like:
// const deserializeBlock = ({ conditions, target }: { target: string, conditions: Condition[] }) =>
//   conditions.reduce((graph, condition) => {
//    }, {});
const triplesToBlocks =
  ({
    defaultPageTitle,
    toPage,
    nodeFormatsByLabel = {},
  }: {
    defaultPageTitle: string;
    toPage: (title: string, blocks: InputTextNode[]) => Promise<void>;
    nodeSpecificationsByLabel?: Record<string, Condition[]>;
    nodeFormatsByLabel?: Record<string, string>;
  }) =>
  (
    triples: {
      source: string;
      target: string;
      relation: string;
    }[],
  ) =>
  () => {
    const relationToTitle = (source: string) => {
      const rel = triples.find(
        (h) =>
          h.source === source &&
          [/is a/i, /has title/i, /with text/i, /with uid/i].some((r) =>
            r.test(h.relation),
          ),
      ) || {
        relation: "",
        target: "",
      };
      return /is a/i.test(rel.relation)
        ? {
            text: (nodeFormatsByLabel[rel.target] || "")
              .replace("{content}", `This is a ${rel.target} page.`)
              .replace(".+", "This is a page of any node type"),
            isPage: true,
          }
        : /has title/i.test(rel.relation)
          ? { text: rel.target, isPage: true }
          : /with text/i.test(rel.relation)
            ? { text: rel.target, isPage: false }
            : /with uid/i.test(rel.relation)
              ? { text: rel.target, isPage: false }
              : { text: source, isPage: true };
    };
    const blockReferences = new Set<{
      uid: string;
      text: string;
    }>();
    const toBlock = (source: string): InputTextNode => ({
      text: `${[
        ...triples
          .filter((e) => /with text/i.test(e.relation) && e.source === source)
          .map((e) => e.target),
        ...triples
          .filter((e) => /references/i.test(e.relation) && e.source === source)
          .map((e) => {
            const target = relationToTitle(e.target);
            if (target.isPage && target.text) return `[[${target.text}]]`;
            else if (target.text) return `((${target.text}))`;
            const text = triples.find(
              (h) => h.source === e.target && /with text/i.test(h.relation),
            )?.target;
            if (text) {
              const uid = window.roamAlphaAPI.util.generateUID();
              blockReferences.add({ uid, text });
              return `((${uid}))`;
            }
            return "Invalid Reference Target";
          }),
      ].join(" ")}`,
      children: [
        ...triples
          .filter(
            (c) =>
              [/has child/i, /has descendant/i].some((r) =>
                r.test(c.relation),
              ) && c.source === source,
          )
          .map((c) => toBlock(c.target)),
        ...triples
          .filter(
            (c) => /has ancestor/i.test(c.relation) && c.target === source,
          )
          .map((c) => toBlock(c.source)),
      ],
    });
    const pageTriples = triples.filter((e) => /is in page/i.test(e.relation));
    if (pageTriples.length) {
      const pages = pageTriples.reduce(
        (prev, cur) => ({
          ...prev,
          [cur.target]: [...(prev[cur.target] || []), cur.source],
        }),
        {} as Record<string, string[]>,
      );
      return Promise.all(
        Object.entries(pages).map((p) =>
          toPage(
            relationToTitle(p[0]).text || p[0],
            p[1].map(toBlock).concat(Array.from(blockReferences)),
          ),
        ),
      ).then(() => Promise.resolve());
    } else {
      return toPage(
        defaultPageTitle,
        Array.from(
          triples.reduce(
            (prev, cur) => {
              if (
                [
                  /has attribute/i,
                  /has child/i,
                  /references/i,
                  /with text/i,
                  /has descendant/i,
                ].some((r) => r.test(cur.relation))
              ) {
                if (!prev.leaves.has(cur.source)) {
                  prev.roots.add(cur.source);
                }
                prev.leaves.add(cur.target);
                prev.roots.delete(cur.target);
              } else if (/has ancestor/i.test(cur.relation)) {
                if (!prev.leaves.has(cur.target)) {
                  prev.roots.add(cur.target);
                }
                prev.leaves.add(cur.source);
                prev.roots.delete(cur.source);
              }
              return prev;
            },
            {
              roots: new Set<string>(),
              leaves: new Set<string>(),
            },
          ).roots,
        )
          .map(toBlock)
          .concat(Array.from(blockReferences)),
      );
    }
  };

export default triplesToBlocks;
