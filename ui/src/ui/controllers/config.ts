import type { GatewayBrowserClient } from "../gateway";
import type { ConfigSnapshot } from "../types";
import type { TelegramForm } from "../ui-types";

export type ConfigState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  configLoading: boolean;
  configRaw: string;
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configSnapshot: ConfigSnapshot | null;
  lastError: string | null;
  telegramForm: TelegramForm;
  telegramConfigStatus: string | null;
};

export async function loadConfig(state: ConfigState) {
  if (!state.client || !state.connected) return;
  state.configLoading = true;
  state.lastError = null;
  try {
    const res = (await state.client.request("config.get", {})) as ConfigSnapshot;
    applyConfigSnapshot(state, res);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configLoading = false;
  }
}

export function applyConfigSnapshot(state: ConfigState, snapshot: ConfigSnapshot) {
  state.configSnapshot = snapshot;
  if (typeof snapshot.raw === "string") {
    state.configRaw = snapshot.raw;
  } else if (snapshot.config && typeof snapshot.config === "object") {
    state.configRaw = `${JSON.stringify(snapshot.config, null, 2).trimEnd()}\n`;
  }
  state.configValid = typeof snapshot.valid === "boolean" ? snapshot.valid : null;
  state.configIssues = Array.isArray(snapshot.issues) ? snapshot.issues : [];

  const config = snapshot.config ?? {};
  const telegram = (config.telegram ?? {}) as Record<string, unknown>;
  const allowFrom = Array.isArray(telegram.allowFrom)
    ? (telegram.allowFrom as unknown[])
        .map((v) => String(v ?? "").trim())
        .filter((v) => v.length > 0)
        .join(", ")
    : typeof telegram.allowFrom === "string"
      ? telegram.allowFrom
      : "";

  state.telegramForm = {
    token: typeof telegram.botToken === "string" ? telegram.botToken : "",
    requireMention:
      typeof telegram.requireMention === "boolean" ? telegram.requireMention : true,
    allowFrom,
    proxy: typeof telegram.proxy === "string" ? telegram.proxy : "",
    webhookUrl: typeof telegram.webhookUrl === "string" ? telegram.webhookUrl : "",
    webhookSecret:
      typeof telegram.webhookSecret === "string" ? telegram.webhookSecret : "",
    webhookPath: typeof telegram.webhookPath === "string" ? telegram.webhookPath : "",
  };

  state.telegramConfigStatus = snapshot.valid === false ? "Config invalid." : null;
}

export async function saveConfig(state: ConfigState) {
  if (!state.client || !state.connected) return;
  state.configSaving = true;
  state.lastError = null;
  try {
    await state.client.request("config.set", { raw: state.configRaw });
    await loadConfig(state);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configSaving = false;
  }
}

