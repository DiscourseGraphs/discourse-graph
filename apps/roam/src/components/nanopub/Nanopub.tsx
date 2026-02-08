import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Dialog,
  Button,
  TextArea,
  Tabs,
  Tab,
  TabId,
  Label,
  Tag,
  Text,
  FormGroup,
  InputGroup,
  Classes,
} from "@blueprintjs/core";
import {
  initNanopubSignWasm,
  NANOPUB_REGISTRY_URLS,
  sign,
  TEST_NANOPUB_REGISTRY_URL,
  verifySignature,
} from "@nanopub/nanopub-js";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { OnloadArgs } from "roamjs-components/types";
import findDiscourseNode from "~/utils/findDiscourseNode";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import ContributorManager, {
  creditRoles,
  getCurrentUserOrcid,
} from "./ContributorManager";
import {
  baseRdf,
  defaultPredicates,
  NanopubTripleType,
  PredicateKey,
} from "./NanopubNodeConfig";
import getBlockProps from "~/utils/getBlockProps";
import getExportTypes from "~/utils/getExportTypes";
import { DiscourseNode, NanopubConfig } from "~/utils/getDiscourseNodes";
import { getNodeEnv } from "roamjs-components/util/env";
import runQuery from "~/utils/runQuery";
import PreviewNanopub from "./PreviewNanopub";
import SourceManager from "./SourceManager";
import extractContentFromTitle from "~/utils/extractContentFromTitle";
import matchDiscourseNode from "~/utils/matchDiscourseNode";
import internalError from "~/utils/internalError";

export type NanopubPage = {
  contributors: Contributor[];
  source?: string;
  published?: string;
};
export type Contributor = {
  id: string;
  name: string;
  orcid: string;
  roles: string[];
};

// Helper function to extract content from format (similar to query-builder)
const extractContentFromFormat = ({
  title,
  allNodes = getDiscourseNodes(),
}: {
  title: string;
  allNodes?: DiscourseNode[];
}) => {
  const node = allNodes.find((a) => matchDiscourseNode({ title, ...a }));
  if (!node) return title;
  return extractContentFromTitle(title, node);
};

// TEMP PRIVATE KEY
const PRIVATE_KEY =
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjY1gsFxmak6SOCouJPuEzHNForkqFhgfHE3aAIAx+Y5q6UDEDM9Q0EksheNffJB4iPqsAfiFpY0ARQY92K5r8P4+a78eu9reYrb2WxZb1qPJmvR7XZ6sN1oHD7dd/EyQoJmQsmOKdrqaLRbzR7tZrf52yvKkwNWXcIVhW8uxe7iUgxiojZpW9srKoK/qFRpaUZSKn7Z/zgtDH9FJkYbBsGPDMqp78Kzt+sJb+U2W+wCSSy34jIUxx6QRbzvn6uexc/emFw/1DU5y7zBudhgC7mVk8vX1gUNKyjZBzlOmRcretrANgffqs5fx/TMHN1xtkA/H1u1IKBfKoyk/xThMLAgMBAAECggEAECuG0GZA3HF8OaqFgMG+W+agOvH04h4Pqv4cHjYNxnxpFcNV9nEssTKWSOvCwYy7hrwZBGV3PQzbjFmmrxVFs20+8yCD7KbyKKQZPVC0zf84bj6NTNgvr6DpGtDxINxuGaMjCt7enqhoRyRRuZ0fj2gD3Wqae/Ds8cpDCefkyMg0TvauHSUj244vGq5nt93txUv1Sa+/8tWZ77Dm0s5a3wUYB2IeAMl5WrO2GMvgzwH+zT+4kvNWg5S0Ze4KE+dG3lSIYZjo99h14LcQS9eALC/VBcAJ6pRXaCTT/TULtcLNeOpoc9Fu25f0yTsDt6Ga5ApliYkb7rDhV+OFrw1sYQKBgQDCE9so+dPg7qbp0cV+lbb7rrV43m5s9Klq0riS7u8m71oTwhmvm6gSLfjzqb8GLrmflCK4lKPDSTdwyvd+2SSmOXySw94zr1Pvc7sHdmMRyA7mH3m+zSOOgyCTTKyhDRCNcRIkysoL+DecDhNo4Fumf71tsqDYogfxpAQhn0re8wKBgQDXhMmmT2oXiMnYHhi2k7CJe3HUqkZgmW4W44SWqKHp0V6sjcHm0N0RT5Hz1BFFUd5Y0ZB3JLcah19myD1kKYCj7xz6oVLb8O7LeAZNlb0FsrtD7NU+Hciywo8qESiA7UYDkU6+hsmxaI01DsttMIdG4lSBbEjA7t4IQC5lyr7xiQKBgQCN87YGJ40Y5ZXCSgOZDepz9hqX2KGOIfnUv2HvXsIfiUwqTXs6HbD18xg3KL4myIBOvywSM+4ABYp+foY+Cpcq2btLIeZhiWjsKIrw71+Q/vIe0YDb1PGf6DsoYhmWBpdHzR9HN+hGjvwlsYny2L9Qbfhgxxmsuf7zeFLpQLijjwKBgH7TD28k8IOk5VKec2CNjKd600OYaA3UfCpP/OhDl/RmVtYoHWDcrBrRvkvEEd2/DZ8qw165Zl7gJs3vK+FTYvYVcfIzGPWA1KU7nkntwewmf3i7V8lT8ZTwVRsmObWU60ySJ8qKuwoBQodki2VX12NpMN1wgWe3qUUlr6gLJU4xAoGAet6nD3QKwk6TTmcGVfSWOzvpaDEzGkXjCLaxLKh9GreM/OE+h5aN2gUoFeQapG5rUwI/7Qq0xiLbRXw+OmfAoV2XKv7iI8DjdIh0F06mlEAwQ/B0CpbqkuuxphIbchtdcz/5ra233r3BMNIqBl3VDDVoJlgHPg9msOTRy13lFqc=";

export const NanoPubTitleButtons = ({
  uid,
  onloadArgs,
}: {
  uid: string;
  onloadArgs: OnloadArgs;
}) => {
  return (
    <div className="github-sync-container flex space-x-2">
      <Button
        text="Nanopub"
        icon="git-push"
        minimal
        outlined
        onClick={() => {
          render({ uid, onloadArgs });
        }}
      />
    </div>
  );
};

export const NanopubTriple = ({
  subject,
  object,
  predicate,
}: {
  subject: string;
  object: string;
  predicate: string;
}) => (
  <div className="grid grid-cols-12 gap-4 border-0 border-b py-2 sm:border-b-0">
    <Text className="col-span-12 truncate sm:col-span-2" title={subject}>
      {subject}
    </Text>
    <Text className="col-span-12 truncate sm:col-span-2" title={predicate}>
      {predicate}
    </Text>
    <Text className="col-span-12 truncate sm:col-span-8" title={object}>
      {object}
    </Text>
  </div>
);

const getPageContent = async ({
  pageTitle,
  uid,
}: {
  pageTitle: string;
  uid: string;
}): Promise<string> => {
  const htmlExport = getExportTypes({
    exportId: "nanopub",
    results: [{ text: pageTitle, uid }],
    isExportDiscourseGraph: false,
  }).find((type) => type.name === "HTML");
  if (!htmlExport) return "";
  const result = await htmlExport.callback({
    includeDiscourseContext: false,
    filename: "",
    isExportDiscourseGraph: false,
  });
  const { content } = result[0];
  const bodyContent = content.match(/<body>([\s\S]*)<\/body>/i)?.[0] || "";

  return bodyContent;
};

export const updateObjectPlaceholders = async ({
  object,
  pageUid,
  nanopubConfig,
  extensionAPI,
  orcid,
}: {
  object: string;
  pageUid: string;
  nanopubConfig?: NanopubConfig;
  extensionAPI: any;
  orcid: string;
}) => {
  const pageTitle = getPageTitleByPageUid(pageUid);
  const pageUrl = `https://roamresearch.com/#/app/${window.roamAlphaAPI.graph.name}/page/${pageUid}`;
  const orcidUrl = `https://orcid.org/${orcid}`;

  let contentUid = pageUid;
  if (nanopubConfig?.useCustomBody) {
    const results = await runQuery({
      extensionAPI,
      parentUid: nanopubConfig?.customBodyUid,
      inputs: { NODETEXT: pageTitle, NODEUID: pageUid },
    });

    contentUid = results.results[0]?.uid;
  }

  return object
    .replace(/\{nodeType\}/g, nanopubConfig?.nodeType || "")
    .replace(/\{title\}/g, extractContentFromFormat({ title: pageTitle }))
    .replace(/\{url\}/g, pageUrl)
    .replace(/\{myORCID\}/g, orcidUrl)
    .replace(/\{createdBy\}/g, orcidUrl)
    .replace(/\{body\}/g, await getPageContent({ pageTitle, uid: contentUid }));
};

const NanopubDialog = ({
  uid,
  onloadArgs,
}: {
  uid: string;
  onloadArgs: any;
}) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = () => setIsOpen(false);
  const [rdfString, setRdfString] = useState("");
  const [error, setError] = useState<string>("");
  const props = useMemo(
    () => getBlockProps(uid) as Record<string, unknown>,
    [uid],
  );
  const nanopub = props["nanopub"] as NanopubPage;
  const initialContributors = nanopub?.contributors || [];
  const initialSource = nanopub?.source;
  const propsUrl = nanopub?.published;
  const [contributors, setContributors] =
    useState<Contributor[]>(initialContributors);
  const [source, setSource] = useState<string>(initialSource || "");
  const [publishedURL, setPublishedURL] = useState(propsUrl);
  const [selectedTabId, setSelectedTabId] = useState<TabId>("nanopub-details");
  const [discourseNode, setDiscourseNode] = useState<DiscourseNode | null>(
    null,
  );
  useEffect(() => {
    const node = findDiscourseNode({ uid });
    setDiscourseNode(node || null);
  }, [uid]);
  const nanopubConfig = discourseNode?.nanopub;
  const templateTriples = nanopubConfig?.triples;

  const generateRdfString = async ({
    triples,
    isExample = false, // TEMP
  }: {
    triples: NanopubTripleType[];
    isExample?: boolean;
  }): Promise<string> => {
    const rdf = { ...baseRdf };

    const updatePlaceHolderProps = {
      pageUid: uid,
      nanopubConfig,
      extensionAPI,
      orcid,
    };

    const objectIdentifierIds = [
      "rdf:type",
      "foaf:page",
      "dc:creator",
      "prov:wasAttributedTo",
    ];

    const createGraph = async (type: string, idPrefix: string) => {
      const relevantTriples = triples.filter((triple) => triple.type === type);

      const triplePromises = relevantTriples.map(async (triple) => {
        const predicate = defaultPredicates[triple.predicate as PredicateKey];
        const objectIdentifier = objectIdentifierIds.includes(predicate)
          ? "@id"
          : "@value";
        const objectvalue = await updateObjectPlaceholders({
          object: triple.object,
          ...updatePlaceHolderProps,
        });

        return {
          [predicate]: { [objectIdentifier]: objectvalue },
        };
      });

      const tripleObjects = await Promise.all(triplePromises);

      return [
        {
          "@id": idPrefix,
          ...Object.assign({}, ...tripleObjects),
        },
      ];
    };

    rdf["@graph"]["np:hasAssertion"]["@graph"] = await createGraph(
      "assertion",
      `#${discourseNode?.text}`,
    );
    rdf["@graph"]["np:hasProvenance"]["@graph"] = await createGraph(
      "provenance",
      "#assertion",
    );
    rdf["@graph"]["np:hasPublicationInfo"]["@graph"] = await createGraph(
      "publication info",
      "#",
    );

    const pubInfoGraph = rdf["@graph"]["np:hasPublicationInfo"]["@graph"];

    // Add timestamp to publication info
    pubInfoGraph.push({
      "@id": "#",
      "dc:created": {
        "@value": new Date().toISOString(),
        "@type": "xsd:dateTime",
      },
    });

    // Alias predicates and contributor roles
    const addAliases = ({
      id,
      label,
      prefix,
    }: {
      id: string;
      label: string;
      prefix: string;
    }) => {
      pubInfoGraph.push({
        "@id": prefix + id,
        "rdfs:label": label,
      });
    };
    Object.entries(defaultPredicates).forEach(([key, value]) => {
      addAliases({
        id: value,
        label: key,
        prefix: "",
      });
    });

    creditRoles.forEach((role) => {
      addAliases({
        id: role.uri,
        label: role.verb,
        prefix: "credit:",
      });
    });

    addAliases({
      id: "prov:wasDerivedFrom",
      label: "has source",
      prefix: "",
    });

    // Add contributors to provenance
    if (contributors.length) {
      const props = getBlockProps(uid) as Record<string, unknown>;
      const nanopub = props["nanopub"] as NanopubPage;
      const contributors = nanopub?.contributors || [];

      const provenanceGraph = rdf["@graph"]["np:hasProvenance"]["@graph"];

      // Add contributors with their ORCIDs and names as aliases
      contributors.forEach((contributor) => {
        if (!contributor.orcid) return; // Skip if no ORCID

        // Add roles using ORCID as identifier
        contributor.roles.forEach((role) => {
          const roleUri = creditRoles.find((r) => r.label === role)?.uri;
          if (roleUri) {
            provenanceGraph.push({
              "@id": "#assertion",
              [`credit:${roleUri}`]: {
                "@id": `https://orcid.org/${contributor.orcid}`,
              },
            });
          }
        });
      });
    }

    // Alias ORCID
    if (orcidUrl) {
      addAliases({
        id: orcidUrl,
        label: getCurrentUserDisplayName(),
        prefix: "",
      });
    }

    // Alias each contributor ORCID
    contributors.forEach((contributor) => {
      if (!contributor.orcid) return;
      addAliases({
        id: `https://orcid.org/${contributor.orcid}`,
        label: contributor.name,
        prefix: "",
      });
    });

    // Add source if it exists (replacing the old requireSource check)
    if (source) {
      const provenanceGraph = rdf["@graph"]["np:hasProvenance"]["@graph"];
      provenanceGraph.push({
        "@id": "#assertion",
        "prov:wasDerivedFrom": { "@id": source },
      });
    }

    // Add additional information
    pubInfoGraph.push(
      { "@id": "#", "@type": "kpxl:DiscourseGraphNanopub" },
      { "@id": "#", "npx:introduces": { "@id": `#${discourseNode?.text}` } },
    );

    // Alias discourse node type
    if (nanopubConfig?.nodeType) {
      pubInfoGraph.push({
        "@id": nanopubConfig.nodeType,
        "rdfs:label": discourseNode?.text,
      });
    }

    // TEMP add exampleNanopub
    if (isExample) {
      pubInfoGraph.push({ "@id": "#", "@type": "npx:ExampleNanopub" });
    }

    return JSON.stringify(rdf, null, 2);
  };

  // DEV
  const [rdfOutput, setRdfOutput] = useState("");
  const [checkedOutput, setCheckedOutput] = useState("");
  const [signedOutput, setSignedOutput] = useState("");
  const [publishedOutput, setPublishedOutput] = useState("");
  // const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [addDevUrl, setAddDevUrl] = useState("");

  // DEV
  const isDev = getNodeEnv() === "development";
  // const generateKeyPair = () => {
  // const keypair = new KeyPair().toJs();
  // setKeyPair(keypair);
  // console.log(keypair);
  // };
  const checkNanopub = async () => {
    try {
      const isValid = await verifySignature(rdfString);
      const checked = {
        validSignature: isValid,
      };
      console.log("Checked info dict:", checked);
      setCheckedOutput(JSON.stringify(checked, null, 2));
    } catch (error) {
      console.error("Error checking nanopub:", error);
      const message =
        error instanceof Error ? error.message : "Failed to check nanopub";
      setCheckedOutput(JSON.stringify({ error: message }, null, 2));
    }
  };
  const signNanopub = async () => {
    try {
      console.log("signNanopub");
      console.log(PRIVATE_KEY);
      const name = getCurrentUserDisplayName();
      console.log(orcidUrl);
      console.log(name);
      const signed = await sign(rdfString, PRIVATE_KEY, orcidUrl, name);
      console.log("Signed info dict:", signed);
      setSignedOutput(JSON.stringify(signed, null, 2));
    } catch (error) {
      console.error("Error signing nanopub:", error);
    }
  };
  const DevDetails = () => {
    return (
      <div className="bp3-dialog-body flex flex-col space-y-4">
        <div className="dev">
          <p>
            Key Pair:{" "}
            {/* {keyPair
              ? `Public-${keyPair.public.length} Private-${keyPair.private.length}`
              : "No output"} */}
            {/* {keyPair?.toJs()} */}
          </p>
          <p>
            Checked Output: {checkedOutput ? checkedOutput.length : "No output"}
          </p>
          <p>
            Signed Output: {signedOutput ? signedOutput.length : "No output"}
          </p>
          <p>
            Published Output:{" "}
            {publishedOutput ? publishedOutput.length : "No output"}
          </p>
          <p>RDF Output: {rdfOutput ? rdfOutput.length : "No output"}</p>
          <p>
            Published URL:{" "}
            {publishedURL ? (
              <a href={publishedURL} target="_blank" rel="noopener noreferrer">
                Link
              </a>
            ) : (
              "No URL"
            )}
          </p>
        </div>
        <div className="dev flex space-x-2">
          <Button
            onClick={() => {
              window.roamAlphaAPI.updateBlock({
                block: {
                  uid,
                  props: {},
                },
              });
            }}
            intent="primary"
          >
            Clear Props
          </Button>
          <Button
            onClick={() => {
              if (!templateTriples) return console.log("No triples");
              console.log(generateRdfString({ triples: templateTriples }));
            }}
            intent={"primary"}
          >
            Console Log RDF
          </Button>
          {/* <Button onClick={generateKeyPair} intent={"primary"}>
            Generate Key Pair
          </Button> */}
          <Button onClick={checkNanopub} intent={"primary"}>
            Check
          </Button>
          <Button onClick={signNanopub} intent={"primary"}>
            Sign
          </Button>
          <Button
            onClick={() => publishNanopub({ useTestServer: true })}
            intent={"primary"}
          >
            Publish Test Server
          </Button>
        </div>
        <FormGroup label="Add Publish URL">
          <InputGroup
            value={addDevUrl}
            onChange={(e) => setAddDevUrl(e.target.value)}
            className="mb-4"
          />
          <Button
            onClick={() => {
              const props = getBlockProps(uid) as Record<string, unknown>;
              const nanopub = props["nanopub"] as NanopubPage;
              window.roamAlphaAPI.updateBlock({
                block: {
                  uid,
                  props: {
                    ...props,
                    nanopub: { ...nanopub, published: addDevUrl },
                  },
                },
              });
              setPublishedURL(addDevUrl);
              setSelectedTabId("nanopub-details");
            }}
            intent={"primary"}
          >
            Add URL
          </Button>
        </FormGroup>
      </div>
    );
  };
  // END DEV

  const orcid = getCurrentUserOrcid();
  const orcidRegex = /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{4}$/;
  const orcidUrl = `https://orcid.org/${orcid}`;

  const publishNanopub = async ({
    useTestServer = isDev,
    isExample = false,
  }: {
    useTestServer?: boolean;
    isExample?: boolean;
  }) => {
    if (!orcidUrl) {
      setError(
        "ORCID is required. Please set your ORCID in the main settings.",
      );
      return;
    }
    if (!orcidRegex.test(orcidUrl)) {
      setError("ORCID must be in the format 0000-0000-0000-0000");
      return;
    }
    if (nanopubConfig?.requireContributors && contributors.length === 0) {
      setError(
        "This template requires contributors. Please add contributors to the nanopub.",
      );
      return;
    }
    if (nanopubConfig?.requireSource && !source) {
      setError(
        "This template requires a source. Please add a source to the nanopub.",
      );
      return;
    }
    const rdfString = await generateRdfString({
      triples: templateTriples || [],
      isExample, // TEMP
    });
    const serverUrl = useTestServer
      ? TEST_NANOPUB_REGISTRY_URL
      : NANOPUB_REGISTRY_URLS[1] || NANOPUB_REGISTRY_URLS[0];
    const currentUser = getCurrentUserDisplayName();
    try {
      const signed = await sign(rdfString, PRIVATE_KEY, orcidUrl, currentUser);
      const publishResponse = await fetch(serverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/trig",
        },
        body: signed.signedRdf,
      });
      if (!publishResponse.ok) {
        const errorBody = await publishResponse.text().catch(() => "");
        throw new Error(
          `Nanopub publish failed: ${publishResponse.status} ${errorBody || publishResponse.statusText}`,
        );
      }
      const url =
        signed.sourceUri ||
        publishResponse.headers.get("Location") ||
        publishResponse.headers.get("location") ||
        "";
      const publishedInfo = {
        uri: url,
        server: serverUrl,
        status: publishResponse.status,
        statusText: publishResponse.statusText,
        signature: signed.signature,
      };
      console.log("Published info dict:", publishedInfo);
      setPublishedOutput(JSON.stringify(publishedInfo, null, 2));
      setRdfOutput(signed.signedRdf);
      setPublishedURL(url);
      const props = getBlockProps(uid) as Record<string, unknown>;
      const nanopub = props["nanopub"] as NanopubPage;
      window.roamAlphaAPI.updateBlock({
        block: {
          uid,
          props: {
            ...props,
            nanopub: { ...nanopub, published: url },
          },
        },
      });
      setSelectedTabId("nanopub-details");
    } catch (e) {
      const error = e as Error;
      console.error("Error publishing the Nanopub:", error);
      setPublishedOutput(JSON.stringify({ error: error.message }, null, 2));
      internalError({
        error,
        type: "Nanopub Publish Failed",
        context: {
          templateTriples,
          contributors,
          rdfString,
          orcidUrl,
        },
      });
    }
  };

  const generateAndSetRDF = useCallback(async () => {
    const rdfString = await generateRdfString({
      triples: templateTriples || [],
    });
    setRdfString(rdfString);
  }, [templateTriples]);

  // Tabs
  const NanopubDetails = () => {
    return (
      <div className="flex flex-col space-y-6">
        <div>
          <Label>Status</Label>
          <span>
            {publishedURL ? (
              <Tag intent="success">Published</Tag>
            ) : (
              <Tag>Not Published</Tag>
            )}
          </span>
        </div>
        <div>
          <Label>URL</Label>
          <span>
            {publishedURL ? (
              <a href={publishedURL} target="_blank" rel="noopener noreferrer">
                {publishedURL}
              </a>
            ) : (
              "N/A"
            )}
          </span>
        </div>
      </div>
    );
  };
  const NanopubTemplate = ({
    node,
    handleClose,
  }: {
    node: string;
    handleClose: () => void;
  }) => {
    const uniqueTypes = Array.from(
      new Set(templateTriples?.map((triple) => triple.type) || []),
    );

    return (
      <>
        <div>
          {uniqueTypes.map((type) => (
            <div key={type}>
              <h3 className="mb-2 text-lg font-semibold capitalize">{type}</h3>
              {templateTriples
                ?.filter((triple) => triple.type === type)
                .map((triple) => (
                  <NanopubTriple
                    key={triple.uid}
                    subject={discourseNode?.text || ""}
                    predicate={triple.predicate}
                    object={triple.object}
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button
            text="View Template"
            icon="link"
            onClick={() => {
              window.roamAlphaAPI.ui.mainWindow.openPage({
                page: {
                  title: `discourse-graph/nodes/${node}`,
                },
              });
              handleClose();
            }}
          />
        </div>
      </>
    );
  };

  const TripleString = () => {
    return (
      <div className="mt-4 space-x-2">
        <TextArea
          value={rdfString}
          fill
          rows={30}
          className="mb-4 overflow-y-auto font-mono text-sm"
        />
        <Button
          onClick={async () => {
            const rdfString = await generateRdfString({
              triples: templateTriples || [],
            });
            setRdfString(rdfString);
          }}
          intent={"primary"}
        >
          Refresh
        </Button>
        <Button
          onClick={async () => {
            const rdfString = await generateRdfString({
              triples: templateTriples || [],
              isExample: true,
            });
            setRdfString(rdfString);
          }}
          intent={"primary"}
        >
          Refresh with Example
        </Button>
      </div>
    );
  };

  // Init WASM
  useEffect(() => {
    initNanopubSignWasm()
      .then(() => {
        console.log("Nanopub WASM initialized");
      })
      .catch((error) => {
        console.error("Error initializing Nanopub WASM:", error);
      });
  }, []);
  // Generate Initial RDF String
  useEffect(() => {
    generateAndSetRDF();
  }, [generateAndSetRDF]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      // title="Nanopub Publication"
      autoFocus={false}
      enforceFocus={false}
      className="w-full bg-white sm:w-full md:w-3/4 lg:w-full lg:max-w-7xl"
      style={{ height: "80vh" }}
    >
      {discourseNode ? (
        <>
          <div className={`${Classes.DIALOG_BODY} overflow-auto p-1`}>
            <div className="space-y-4">
              <Tabs
                selectedTabId={selectedTabId}
                onChange={(id) => {
                  setError("");
                  setSelectedTabId(id);
                }}
              >
                <Tab
                  id="nanopub-details"
                  title="Details"
                  panel={<NanopubDetails />}
                />
                <Tab
                  id="nanopub-contributors"
                  title="Contributors"
                  panel={
                    <ContributorManager
                      pageUid={uid}
                      pageProps={props}
                      contributors={contributors}
                      setContributors={setContributors}
                      node={discourseNode.text}
                      handleClose={handleClose}
                      requireContributors={nanopubConfig?.requireContributors}
                    />
                  }
                />
                <Tab
                  id="nanopub-source"
                  title="Source"
                  panel={
                    <SourceManager
                      pageUid={uid}
                      pageProps={props}
                      source={source}
                      setSource={setSource}
                      requireSource={nanopubConfig?.requireSource}
                    />
                  }
                />
                <Tab
                  id="nanopub-preview"
                  title="Preview"
                  panel={
                    <PreviewNanopub
                      contributors={contributors}
                      templateTriples={templateTriples}
                      discourseNode={discourseNode}
                      extensionAPI={extensionAPI}
                      pageUid={uid}
                      source={source}
                    />
                  }
                />
                <Tab
                  hidden={!isDev}
                  id="nanopub-template"
                  title="Template"
                  panel={
                    <NanopubTemplate
                      node={discourseNode.text}
                      handleClose={handleClose}
                    />
                  }
                />
                <Tab
                  hidden={!isDev}
                  id="triple-string"
                  title="RDF"
                  panel={<TripleString />}
                />
                <Tab
                  hidden={!isDev}
                  id="dev-details"
                  title="Dev"
                  panel={<DevDetails />}
                />
              </Tabs>
            </div>
            {error && <p className="text-right text-red-500">{error}</p>}
          </div>
          <div className={Classes.DIALOG_FOOTER}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button onClick={handleClose}>Close</Button>
              <Button
                onClick={() => setSelectedTabId("nanopub-preview")}
                disabled={selectedTabId === "nanopub-preview"}
                hidden={!!publishedURL}
              >
                Preview
              </Button>
              <Button
                onClick={() => publishNanopub({})}
                intent={"primary"}
                disabled={selectedTabId !== "nanopub-preview"}
                // hidden={!!publishedURL}
              >
                Publish Nanopub
              </Button>

              {/* TEMP */}
              <Button
                onClick={() => publishNanopub({ isExample: true })}
                intent={"primary"}
                disabled={selectedTabId !== "nanopub-preview"}
                // hidden={!!publishedURL}
              >
                Publish Example Nanopub
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="bp3-dialog-body">
          <p>No node found</p>
          <Button onClick={handleClose}>Close</Button>
        </div>
      )}
    </Dialog>
  );
};

export const render = ({ uid, onloadArgs }: { uid: string; onloadArgs: any }) =>
  renderOverlay({ Overlay: NanopubDialog, props: { uid, onloadArgs } });
