import type { GatewayBrowserClient } from "../gateway";
import { parseList } from "../format";
import type { ConfigSnapshot, ProvidersStatusSnapshot } from "../types";
import type { TelegramForm } from "../ui-types";

export type ConnectionsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  providersLoading: boolean;
  providersSnapshot: ProvidersStatusSnapshot | null;
  providersError: string | null;
  providersLastSuccess: number | null;
  whatsappLoginMessage: string | null;
  whatsappLoginQrDataUrl: string | null;
  whatsappLoginConnected: boolean | null;
  whatsappBusy: boolean;
  telegramForm: TelegramForm;
  telegramSaving: boolean;
  telegramTokenLocked: boolean;
  telegramConfigStatus: string | null;
  configSnapshot: ConfigSnapshot | null;
};

export async function loadProviders(state: ConnectionsState, probe: boolean) {
  if (!state.client || !state.connected) return;
  if (state.providersLoading) return;
  state.providersLoading = true;
  state.providersError = null;
  try {
    const res = (await state.client.request("providers.status", {
      probe,
      timeoutMs: 8000,
    })) as ProvidersStatusSnapshot;
    state.providersSnapshot = res;
    state.providersLastSuccess = Date.now();
    state.telegramTokenLocked = res.telegram.tokenSource === "env";
  } catch (err) {
    state.providersError = String(err);
  } finally {
    state.providersLoading = false;
  }
}

export async function startWhatsAppLogin(state: ConnectionsState, force: boolean) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    const res = (await state.client.request("web.login.start", {
      force,
      timeoutMs: 30000,
    })) as { message?: string; qrDataUrl?: string };
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginQrDataUrl = res.qrDataUrl ?? null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function waitWhatsAppLogin(state: ConnectionsState) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    const res = (await state.client.request("web.login.wait", {
      timeoutMs: 120000,
    })) as { connected?: boolean; message?: string };
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginConnected = res.connected ?? null;
    if (res.connected) state.whatsappLoginQrDataUrl = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function logoutWhatsApp(state: ConnectionsState) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    await state.client.request("web.logout", {});
    state.whatsappLoginMessage = "Logged out.";
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
  } finally {
    state.whatsappBusy = false;
  }
}

export function updateTelegramForm(
  state: ConnectionsState,
  patch: Partial<TelegramForm>,
) {
  state.telegramForm = { ...state.telegramForm, ...patch };
}

export async function saveTelegramConfig(state: ConnectionsState) {
  if (!state.client || !state.connected) return;
  if (state.telegramSaving) return;
  state.telegramSaving = true;
  state.telegramConfigStatus = null;
  try {
    const base = state.configSnapshot?.config ?? {};
    const config = { ...base } as Record<string, unknown>;
    const telegram = { ...(config.telegram ?? {}) } as Record<string, unknown>;
    if (!state.telegramTokenLocked) {
      const token = state.telegramForm.token.trim();
      if (token) telegram.botToken = token;
      else delete telegram.botToken;
    }
    telegram.requireMention = state.telegramForm.requireMention;
    const allowFrom = parseList(state.telegramForm.allowFrom);
    if (allowFrom.length > 0) telegram.allowFrom = allowFrom;
    else delete telegram.allowFrom;
    const proxy = state.telegramForm.proxy.trim();
    if (proxy) telegram.proxy = proxy;
    else delete telegram.proxy;
    const webhookUrl = state.telegramForm.webhookUrl.trim();
    if (webhookUrl) telegram.webhookUrl = webhookUrl;
    else delete telegram.webhookUrl;
    const webhookSecret = state.telegramForm.webhookSecret.trim();
    if (webhookSecret) telegram.webhookSecret = webhookSecret;
    else delete telegram.webhookSecret;
    const webhookPath = state.telegramForm.webhookPath.trim();
    if (webhookPath) telegram.webhookPath = webhookPath;
    else delete telegram.webhookPath;

    config.telegram = telegram;
    const raw = `${JSON.stringify(config, null, 2).trimEnd()}\n`;
    await state.client.request("config.set", { raw });
    state.telegramConfigStatus = "Saved. Restart gateway if needed.";
  } catch (err) {
    state.telegramConfigStatus = String(err);
  } finally {
    state.telegramSaving = false;
  }
}

