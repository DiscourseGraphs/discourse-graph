import { Notice, Platform } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { handleMcpBridgeHttpRequest } from "./mcpBridgeHttp.js";
import { createMcpBridgeReadApi } from "./mcpBridgeRead.js";
import { createMcpBridgeWriteApi } from "./mcpBridgeWrite.js";
import { createMcpBridgeWriteStore } from "./mcpBridgeWriteStore.js";
import {
  createMcpWriteApprovalService,
  type McpWriteApprovalService,
} from "./mcpWriteApprovalService.js";
import {
  buildMcpBridgeHealth,
  DEFAULT_MCP_BRIDGE_PORT,
  type McpBridgeContext,
  type McpBridgeHealth,
} from "./mcpBridge.types.js";
import {
  getLocalSpaceUri,
  getSupabaseContext,
  getVaultId,
} from "~/utils/supabaseContext";

export {
  DEFAULT_MCP_BRIDGE_PORT,
  MCP_BRIDGE_CONTEXT_PATH,
  MCP_BRIDGE_HEALTH_PATH,
  MCP_BRIDGE_SERVICE_NAME,
  MCP_BRIDGE_VERSION,
  buildMcpBridgeHealth,
} from "./mcpBridge.types.js";
export type { McpBridgeContext, McpBridgeHealth } from "./mcpBridge.types.js";
export type { McpBridgeRequestHandler } from "./mcpBridgeHttp.js";
export { handleMcpBridgeHttpRequest } from "./mcpBridgeHttp.js";

export type McpBridgeService = {
  getPort: () => number | null;
  getHealth: () => McpBridgeHealth | null;
  start: () => Promise<{ port: number } | null>;
  stop: () => Promise<void>;
  getApprovalState: () => ReturnType<McpWriteApprovalService["getState"]> | null;
};

type HttpServer = {
  close: (callback?: (error?: Error) => void) => void;
  listen: (
    port: number,
    host: string,
    callback: () => void,
  ) => void;
  on: (event: string, callback: (error: NodeJS.ErrnoException) => void) => void;
  address: () => { port: number } | string | null;
};

type HttpModule = {
  createServer: (
    handler: (
      request: import("node:http").IncomingMessage,
      response: import("node:http").ServerResponse,
    ) => void,
  ) => HttpServer;
};

/** Dynamic require — static `node:http` imports break Obsidian's Electron bundle. */
const loadHttpModule = (): HttpModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("http") as HttpModule;
  } catch (error) {
    console.error("[dg-mcp-bridge] Node http module unavailable:", error);
    return null;
  }
};

const bridgeBaseUrl = (port: number): string => `http://127.0.0.1:${port}`;

const writeJson = (
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
): void => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
};

export const buildMcpBridgeContext = async (
  plugin: DiscourseGraphPlugin,
): Promise<McpBridgeContext> => {
  const vaultId = getVaultId(plugin.app);
  const vaultName = plugin.app.vault.getName() || "obsidian-vault";
  const syncEnabled = plugin.settings.syncModeEnabled === true;
  const spaceUrl = getLocalSpaceUri(plugin.app);

  const base: McpBridgeContext = {
    platform: "Obsidian",
    vaultId,
    vaultName,
    syncEnabled,
    spaceUrl: syncEnabled ? spaceUrl : undefined,
  };

  if (!syncEnabled) {
    return base;
  }

  try {
    const context = await getSupabaseContext(plugin);
    if (!context) {
      return base;
    }

    return {
      ...base,
      spaceId: context.spaceId,
      spaceUrl,
      spacePassword: context.spacePassword,
    };
  } catch (error) {
    console.error("[dg-mcp-bridge] Failed to load Supabase context:", error);
    return base;
  }
};

export const createMcpBridgeService = (
  plugin: DiscourseGraphPlugin,
): McpBridgeService => {
  let server: HttpServer | undefined;
  let port: number | null = null;
  let health: McpBridgeHealth | null = null;
  const writeStore = createMcpBridgeWriteStore();
  const writeApi = createMcpBridgeWriteApi(writeStore);
  let approvalService: McpWriteApprovalService | null = null;

  const getHandler = () => ({
    getHealth: () => {
      if (!health || port === null) {
        throw new Error("MCP bridge is not running");
      }
      return health;
    },
    getContext: () => buildMcpBridgeContext(plugin),
    read: createMcpBridgeReadApi(plugin),
    write: writeApi,
  });

  const stop = async (): Promise<void> => {
    approvalService?.stop();
    approvalService = null;

    if (!server) {
      port = null;
      health = null;
      return;
    }

    const activeServer = server;
    server = undefined;
    port = null;
    health = null;

    await new Promise<void>((resolve, reject) => {
      activeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  const start = async (): Promise<{ port: number } | null> => {
    if (!Platform.isDesktop) {
      console.warn("[dg-mcp-bridge] MCP bridge is only available on desktop");
      return null;
    }

    const http = loadHttpModule();
    if (!http) {
      new Notice(
        "Discourse Graph MCP bridge: Node http module unavailable on this platform.",
        8000,
      );
      return null;
    }

    if (server && port !== null) {
      return { port };
    }

    const vaultId = getVaultId(plugin.app);
    const vaultName = plugin.app.vault.getName() || "obsidian-vault";
    const listenPort = DEFAULT_MCP_BRIDGE_PORT;

    return new Promise((resolve) => {
      const bridgeServer = http.createServer((request, response) => {
        handleMcpBridgeHttpRequest(request, response, getHandler()).catch(
          (error: unknown) => {
            console.error("[dg-mcp-bridge] Request error:", error);
            if (!response.headersSent) {
              writeJson(response, 500, {
                ok: false,
                error:
                  error instanceof Error ? error.message : String(error),
              });
            } else {
              response.end();
            }
          },
        );
      });

      bridgeServer.on("error", (error: NodeJS.ErrnoException) => {
        const message = `Could not start MCP bridge on port ${listenPort}: ${error.message}`;
        console.error(`[dg-mcp-bridge] ${message}`);
        new Notice(`Discourse Graph MCP bridge: ${error.message}`, 8000);
        resolve(null);
      });

      bridgeServer.listen(listenPort, "127.0.0.1", () => {
        const address = bridgeServer.address();
        const boundPort =
          typeof address === "object" && address?.port
            ? address.port
            : listenPort;

        server = bridgeServer;
        port = boundPort;
        health = buildMcpBridgeHealth({
          port: boundPort,
          vaultId,
          vaultName,
        });

        console.error(
          `[dg-mcp-bridge] Listening at ${bridgeBaseUrl(boundPort)}`,
        );
        new Notice(
          `Discourse Graph MCP bridge listening on port ${boundPort}`,
          5000,
        );

        if (typeof window !== "undefined") {
          approvalService = createMcpWriteApprovalService({
            plugin,
            writeApi,
          });
          approvalService.start();

          window.dgMcpBridge = {
            getHealth: () => health as McpBridgeHealth,
            getPort: () => port,
            getPendingWriteCount: () => writeApi.pendingCount(),
            listPendingWrites: () => writeApi.listPendingWrites(),
            getState: () => ({
              health: health as McpBridgeHealth,
              port,
              ...approvalService!.getState(),
            }),
            refresh: () => approvalService?.refresh(),
            approveBatch: (batchId: string) =>
              approvalService?.approveBatch(batchId) ?? Promise.resolve(),
            rejectBatch: (batchId: string) =>
              approvalService?.rejectBatch(batchId) ?? Promise.resolve(),
          };
        }

        resolve({ port: boundPort });
      });
    });
  };

  return {
    getPort: () => port,
    getHealth: () => health,
    start,
    stop,
    getApprovalState: () => approvalService?.getState() ?? null,
  };
};

declare global {
  interface Window {
    dgMcpBridge?: {
      getHealth: () => McpBridgeHealth;
      getPort: () => number | null;
      getPendingWriteCount: () => number;
      listPendingWrites: () => ReturnType<
        ReturnType<typeof createMcpBridgeWriteApi>["listPendingWrites"]
      >;
      getState: () => {
        health: McpBridgeHealth;
        port: number | null;
        pendingCount: number;
        pendingWrites: ReturnType<
          ReturnType<typeof createMcpBridgeWriteApi>["listPendingWrites"]
        >;
        committingBatchIds: string[];
      };
      refresh: () => void;
      approveBatch: (batchId: string) => Promise<void>;
      rejectBatch: (batchId: string) => Promise<void>;
    };
  }
}
