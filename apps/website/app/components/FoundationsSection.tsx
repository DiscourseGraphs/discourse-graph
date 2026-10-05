import type { CSSProperties, ReactElement, ReactNode } from "react";
import Image from "next/image";
import { ScaledStage } from "~/components/ScaledStage";

// Card size in the Figma frame; positions below use these coordinates.
const CARD_WIDTH = 570;
const CARD_HEIGHT = 390;

type NodeKind = "claim" | "question" | "result";

const NODE_STYLES: Record<
  NodeKind,
  { bold: string; label: string; soft: string; text: string }
> = {
  claim: { bold: "#396618", label: "Claim", soft: "#d5f0c1", text: "#396618" },
  question: {
    bold: "#6e48a0",
    label: "Question",
    soft: "#d7cae7",
    text: "#6e48a0",
  },
  result: {
    bold: "#8e222f",
    label: "Result",
    soft: "#f0c1c7",
    text: "#8e222f",
  },
};

const abs = (left: number, top: number): CSSProperties => ({
  left,
  position: "absolute",
  top,
});

const FoundationCard = ({
  children,
  description,
  headerHeight,
  title,
}: {
  children: ReactNode;
  description: string;
  headerHeight: number;
  title: string;
}): ReactElement => (
  <div className="overflow-hidden rounded-2xl bg-[#f1f1f1] leading-[normal]">
    <div className="px-6 pb-3 pt-6" style={{ minHeight: headerHeight }}>
      <h3 className="text-[24px] font-semibold text-black">{title}</h3>
      <p className="mt-3 max-w-[520px] text-[18px] text-black">{description}</p>
    </div>
    {children}
  </div>
);

const NodePill = ({ kind }: { kind: NodeKind }): ReactElement => (
  <span
    className="rounded-full p-2.5 text-[12px] font-semibold"
    style={{
      backgroundColor: NODE_STYLES[kind].soft,
      color: NODE_STYLES[kind].text,
    }}
  >
    {NODE_STYLES[kind].label}
  </span>
);

type NodeSample = {
  body: string;
  kind: NodeKind;
  left: number;
  title: string;
  top: number;
  width: number;
};

const NODE_SAMPLES: NodeSample[] = [
  {
    body: "Ideas inspired by sources from more distant domains were rated more novel than ideas inspired by close sources, which suggests far analogies help people break out of familiar solutions.",
    kind: "claim",
    left: 118,
    title:
      "Analogical distance of inspirations for an idea are positively related to the idea’s creativity",
    top: 0,
    width: 476,
  },
  {
    body: "Under hypoosmotic shock, a larger share of endocytic sites in human stem cells recruited the Arp2/3 complex, which suggests actin assembly adapts to membrane tension.",
    kind: "result",
    left: 170,
    title:
      "4:1 hypoosmotic shock led to an increase in the percentage of ARPC3-positive endocytosis tracks",
    top: 70,
    width: 448,
  },
  {
    body: "Scholarly knowledge synthesis — the production of a novel conceptual whole such as an effective literature review or theory — is a critical yet consistently challenging subtask of research.",
    kind: "question",
    left: 222,
    title: "What is the role of context in academic literature reviewing?",
    top: 140,
    width: 448,
  },
];

const NODES_OFFSET = 148;

const NodesCard = (): ReactElement => (
  <FoundationCard
    title="Nodes"
    description="Compose modular knowledge units like claims, evidence, questions, and results, or create your own to fit your specific use case."
    headerHeight={NODES_OFFSET}
  >
    <ScaledStage
      width={CARD_WIDTH}
      height={CARD_HEIGHT - NODES_OFFSET}
      label="Three overlapping example nodes: a claim about analogical distance and creativity, a result about hypoosmotic shock and ARPC3-positive endocytosis tracks, and a question about the role of context in academic literature reviewing."
    >
      {NODE_SAMPLES.map((sample) => (
        <div
          key={sample.kind}
          className="h-[195px] overflow-hidden rounded-[20px] border border-black bg-white px-[13px] py-4"
          style={{ ...abs(sample.left, sample.top), width: sample.width }}
        >
          <div className="flex items-start gap-2.5 p-2.5">
            <NodePill kind={sample.kind} />
            <p className="flex-1 text-[16px] font-semibold text-black">
              {sample.title}
            </p>
          </div>
          <p className="p-2.5 text-[16px] text-black">{sample.body}</p>
        </div>
      ))}
    </ScaledStage>
  </FoundationCard>
);

const RELATIONS_OFFSET = 175;

const RELATION_PILLS: {
  kind: NodeKind | "experiment" | "study";
  left: number;
  top: number;
}[] = [
  { kind: "experiment", left: 26, top: 17 },
  { kind: "study", left: 68, top: 101 },
  { kind: "result", left: 176, top: 17 },
  { kind: "result", left: 176, top: 101 },
  { kind: "claim", left: 339, top: 56 },
  { kind: "question", left: 453, top: 56 },
];

const RELATION_COLORS: Record<string, { bg: string; label: string }> = {
  claim: { bg: NODE_STYLES.claim.bold, label: "Claim" },
  experiment: { bg: "#066669", label: "Experiment" },
  question: { bg: NODE_STYLES.question.bold, label: "Question" },
  result: { bg: NODE_STYLES.result.bold, label: "Result" },
  study: { bg: "#064e6e", label: "Study" },
};

const RelationsCard = (): ReactElement => (
  <FoundationCard
    title="Relations"
    description="Nodes can be related using custom ontologies to express scientific argumentation and discourse at the data level and visually on a canvas."
    headerHeight={RELATIONS_OFFSET}
  >
    <ScaledStage
      width={CARD_WIDTH}
      height={CARD_HEIGHT - RELATIONS_OFFSET}
      label="Relation diagram: an experiment and a study each lead to a result. One result opposes a claim and the other supports it. A question also points to the claim."
    >
      <svg
        className="absolute left-0 top-0 overflow-visible"
        width={CARD_WIDTH}
        height={CARD_HEIGHT - RELATIONS_OFFSET}
      >
        <defs>
          <marker
            id="foundations-arrow"
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            orient="auto"
            refX="6"
            refY="4"
          >
            <path
              d="M1 0.5 L5.5 4 L1 7.5"
              fill="none"
              stroke="black"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <g stroke="black" markerEnd="url(#foundations-arrow)">
          <line x1="134" y1="38" x2="176" y2="38" />
          <line x1="134" y1="122" x2="176" y2="122" />
          <line x1="247" y1="38" x2="338" y2="68" />
          <line x1="247" y1="122" x2="338" y2="80" />
          <line x1="453" y1="77" x2="403" y2="77" />
        </g>
      </svg>
      {RELATION_PILLS.map((pill) => (
        <span
          key={`${pill.kind}-${pill.left}-${pill.top}`}
          className="whitespace-nowrap rounded-full border border-black p-2.5 text-[16px] font-semibold text-white"
          style={{
            ...abs(pill.left, pill.top),
            backgroundColor: RELATION_COLORS[pill.kind]?.bg,
          }}
        >
          {RELATION_COLORS[pill.kind]?.label}
        </span>
      ))}
      <span
        className="bg-white p-1 text-[12px] font-medium text-black"
        style={abs(263, 41)}
      >
        opposes
      </span>
      <span
        className="bg-white p-1 text-[12px] font-medium text-black"
        style={abs(262, 91)}
      >
        supports
      </span>
    </ScaledStage>
  </FoundationCard>
);

const SHARING_OFFSET = 156;

const SharingCard = (): ReactElement => (
  <FoundationCard
    title="Sharing"
    description="Share, reuse, and remix nodes across people, tools, and contexts while maintaining attribution and provenance."
    headerHeight={SHARING_OFFSET}
  >
    <ScaledStage
      width={CARD_WIDTH}
      height={CARD_HEIGHT - SHARING_OFFSET}
      label="Example shared result node by Matt Akamatsu of MATSU Lab, dated Jan 31, 2026: undergraduates produced original results within four months of joining the lab, with a Share button."
    >
      <div
        className="overflow-hidden rounded-[20px] border border-black bg-white px-[13px] py-4"
        style={{ ...abs(32, 0), height: 280, width: 506 }}
      >
        <div className="flex items-start gap-2.5 p-2.5">
          <NodePill kind="result" />
          <p className="flex-1 text-[16px] font-semibold text-black">
            With the help of the lab’s discourse graph, undergraduates produced
            original results within four months of joining the lab
          </p>
        </div>
        <div className="flex items-center gap-3 px-2.5 text-[14px] text-black">
          <MetaItem icon="user">Matt Akamatsu</MetaItem>
          <MetaItem icon="earth">MATSU Lab</MetaItem>
          <MetaItem icon="calendar">Jan 31, 2026</MetaItem>
          <span className="rounded bg-[#f6f6f6] px-1 py-0.5">
            <MetaItem icon="share">Share</MetaItem>
          </span>
        </div>
        <p className="p-2.5 text-[16px] text-black">
          Three undergraduate researchers in the MATSUlab produced their first
          formal result (RES node) within 36–125 days of joining the lab (mean:
          69 days), with students assigned to entry projects or existing
          experiments producing results faster (Researcher B: 47 days,
          Researcher C: 36 days) than those with self-directed exploration
          (Researcher A: 125 days).
        </p>
      </div>
      <div
        className="absolute h-[236px] w-[530px] bg-gradient-to-b from-transparent from-50% to-[#f1f1f1] to-95%"
        style={abs(21, -2)}
      />
      <Image
        src="/foundations/cursor.png"
        alt=""
        width={33}
        height={36}
        className="absolute"
        style={abs(436, 109)}
      />
    </ScaledStage>
  </FoundationCard>
);

const ICON_PATHS: Record<string, ReactNode> = {
  calendar: (
    <>
      <path d="M8 2v4M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  earth: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54M7 3.34V5a3 3 0 0 0 3 3 2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17M11 21.95V18a2 2 0 0 0-2-2 2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" />
    </>
  ),
  share: (
    <>
      <path d="M12 2v13" />
      <path d="m16 6-4-4-4 4" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </>
  ),
};

const MetaItem = ({
  children,
  icon,
}: {
  children: ReactNode;
  icon: keyof typeof ICON_PATHS;
}): ReactElement => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[icon]}
    </svg>
    {children}
  </span>
);

const PROTOCOL_OFFSET = 126;

// Exported Figma vectors; `inset` is [top, right, bottom, left] in % to cover
// stroke bleed.
const NETWORK_EDGES: {
  height: number;
  inset: [number, number, number, number];
  left: number;
  src: string;
  top: number;
  width: number;
}[] = [
  {
    height: 107.5,
    inset: [-0.29, -0.47, -0.29, -0.47],
    left: 238.5,
    src: "net-10.svg",
    top: 248.5,
    width: 84,
  },
  {
    height: 28,
    inset: [-1.77, 0, -1.77, 0],
    left: 239.5,
    src: "net-11.svg",
    top: 359,
    width: 184.5,
  },
  {
    height: 85,
    inset: [-0.5, -0.2, -0.5, -0.2],
    left: 427,
    src: "net-12.svg",
    top: 297,
    width: 132.5,
  },
  {
    height: 60,
    inset: [-0.82, 0, -0.82, 0],
    left: 239,
    src: "net-13.svg",
    top: 295.5,
    width: 322,
  },
  {
    height: 206,
    inset: [0, -0.81, 0, -0.81],
    left: 424,
    src: "net-14.svg",
    top: 177,
    width: 59.5,
  },
  {
    height: 204.5,
    inset: [-0.22, 0, -0.15, -0.33],
    left: 324,
    src: "net-15.svg",
    top: 179.5,
    width: 237,
  },
  {
    height: 112,
    inset: [-0.25, -0.54, -0.25, -0.54],
    left: 484,
    src: "net-16.svg",
    top: 182.5,
    width: 76.5,
  },
];

const NETWORK_NODES: {
  height: number;
  left: number;
  src: string;
  top: number;
  width: number;
}[] = [
  { height: 52, left: 188, src: "logo-a.png", top: 302, width: 56 },
  { height: 58, left: 512, src: "logo-b.png", top: 244, width: 59 },
  { height: 58, left: 274, src: "logo-c.png", top: 196, width: 58 },
  { height: 58, left: 433, src: "logo-d.png", top: 126, width: 58 },
];

const ProtocolCard = (): ReactElement => (
  <FoundationCard
    title="Protocol"
    description="Decentralized knowledge exchange with discourse graphs is supported and enabled by an expanding set of platforms."
    headerHeight={PROTOCOL_OFFSET}
  >
    <ScaledStage
      width={CARD_WIDTH}
      height={CARD_HEIGHT - PROTOCOL_OFFSET}
      label="A network of platform logos connected to one another, representing the platforms that support the discourse graph protocol."
    >
      {NETWORK_EDGES.map((edge) => (
        <div
          key={edge.src}
          className="absolute"
          style={{
            height: edge.height,
            left: edge.left,
            top: edge.top - PROTOCOL_OFFSET,
            width: edge.width,
          }}
        >
          <div
            className="absolute"
            style={{
              bottom: `${edge.inset[2]}%`,
              left: `${edge.inset[3]}%`,
              right: `${edge.inset[1]}%`,
              top: `${edge.inset[0]}%`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/foundations/${edge.src}`}
              alt=""
              className="block size-full max-w-none"
            />
          </div>
        </div>
      ))}
      {NETWORK_NODES.map((node) => (
        <div
          key={node.src}
          className="flex size-[100px] items-center justify-center rounded-full border border-black bg-white"
          style={abs(node.left, node.top - PROTOCOL_OFFSET)}
        >
          <Image
            src={`/foundations/${node.src}`}
            alt=""
            width={node.width}
            height={node.height}
            className="object-contain"
          />
        </div>
      ))}
      <Image
        src="/foundations/logo-e.svg"
        alt=""
        width={100}
        height={100}
        className="absolute"
        style={abs(374, 332 - PROTOCOL_OFFSET)}
      />
    </ScaledStage>
  </FoundationCard>
);

export const FoundationsSection = (): ReactElement => (
  <section className="bg-white px-5 pb-8 pt-16 sm:px-6 lg:pb-12 lg:pt-24">
    <div id="foundations" className="mx-auto max-w-6xl scroll-mt-20">
      <h2 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
        Foundations
      </h2>
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <NodesCard />
        <RelationsCard />
        <SharingCard />
        <ProtocolCard />
      </div>
    </div>
  </section>
);
