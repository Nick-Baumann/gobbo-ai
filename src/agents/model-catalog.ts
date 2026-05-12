import { type GobboConfig, loadConfig } from "../config/config.js";
import { resolveGobboAgentDir } from "./agent-paths.js";
import { ensureGobboModelsJson } from "./models-config.js";

export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
};

type DiscoveredModel = {
  id: string;
  name?: string;
  provider: string;
  contextWindow?: number;
};

let modelCatalogPromise: Promise<ModelCatalogEntry[]> | null = null;

export function resetModelCatalogCacheForTest() {
  modelCatalogPromise = null;
}

export async function loadModelCatalog(params?: {
  config?: GobboConfig;
  useCache?: boolean;
}): Promise<ModelCatalogEntry[]> {
  if (params?.useCache === false) {
    modelCatalogPromise = null;
  }
  if (modelCatalogPromise) return modelCatalogPromise;

  modelCatalogPromise = (async () => {
    const piSdk = await import("@mariozechner/pi-coding-agent");

    const models: ModelCatalogEntry[] = [];
    try {
      const cfg = params?.config ?? loadConfig();
      await ensureGobboModelsJson(cfg);
      const agentDir = resolveGobboAgentDir();
      const authStorage = piSdk.discoverAuthStorage(agentDir);
      const registry = piSdk.discoverModels(authStorage, agentDir) as
        | {
            getAll: () => Array<DiscoveredModel>;
          }
        | Array<DiscoveredModel>;
      const entries = Array.isArray(registry) ? registry : registry.getAll();
      for (const entry of entries) {
        const id = String(entry?.id ?? "").trim();
        if (!id) continue;
        const provider = String(entry?.provider ?? "").trim();
        if (!provider) continue;
        const name = String(entry?.name ?? id).trim() || id;
        const contextWindow =
          typeof entry?.contextWindow === "number" && entry.contextWindow > 0
            ? entry.contextWindow
            : undefined;
        models.push({ id, name, provider, contextWindow });
      }
    } catch {
      // Leave models empty on discovery errors.
    }

    return models.sort((a, b) => {
      const p = a.provider.localeCompare(b.provider);
      if (p !== 0) return p;
      return a.name.localeCompare(b.name);
    });
  })();

  return modelCatalogPromise;
}
