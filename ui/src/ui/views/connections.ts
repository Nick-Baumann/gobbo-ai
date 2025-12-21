import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { ProvidersStatusSnapshot } from "../types";
import type { TelegramForm } from "../ui-types";

export type ConnectionsProps = {
  connected: boolean;
  loading: boolean;
  snapshot: ProvidersStatusSnapshot | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  whatsappMessage: string | null;
  whatsappQrDataUrl: string | null;
  whatsappConnected: boolean | null;
  whatsappBusy: boolean;
  telegramForm: TelegramForm;
  telegramTokenLocked: boolean;
  telegramSaving: boolean;
  telegramStatus: string | null;
  onRefresh: (probe: boolean) => void;
  onWhatsAppStart: (force: boolean) => void;
  onWhatsAppWait: () => void;
  onWhatsAppLogout: () => void;
  onTelegramChange: (patch: Partial<TelegramForm>) => void;
  onTelegramSave: () => void;
};

export function renderConnections(props: ConnectionsProps) {
  const whatsapp = props.snapshot?.whatsapp;
  const telegram = props.snapshot?.telegram;

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">WhatsApp</div>
        <div class="card-sub">Link WhatsApp Web and monitor connection health.</div>

        <div class="status-list" style="margin-top: 16px;">
          <div>
            <span class="label">Configured</span>
            <span>${whatsapp?.configured ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Linked</span>
            <span>${whatsapp?.linked ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Running</span>
            <span>${whatsapp?.running ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Connected</span>
            <span>${whatsapp?.connected ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Last connect</span>
            <span>${whatsapp?.lastConnectedAt ? formatAgo(whatsapp.lastConnectedAt) : "n/a"}</span>
          </div>
          <div>
            <span class="label">Last message</span>
            <span>${whatsapp?.lastMessageAt ? formatAgo(whatsapp.lastMessageAt) : "n/a"}</span>
          </div>
          <div>
            <span class="label">Auth age</span>
            <span>
              ${whatsapp?.authAgeMs != null ? formatDuration(whatsapp.authAgeMs) : "n/a"}
            </span>
          </div>
        </div>

        ${whatsapp?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${whatsapp.lastError}
            </div>`
          : nothing}

        ${props.whatsappMessage
          ? html`<div class="callout" style="margin-top: 12px;">
              ${props.whatsappMessage}
            </div>`
          : nothing}

        ${props.whatsappQrDataUrl
          ? html`<div class="qr-wrap">
              <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" />
            </div>`
          : nothing}

        <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
          <button
            class="btn primary"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppStart(false)}
          >
            ${props.whatsappBusy ? "Working…" : "Show QR"}
          </button>
          <button
            class="btn"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppStart(true)}
          >
            Relink
          </button>
          <button
            class="btn"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppWait()}
          >
            Wait for scan
          </button>
          <button
            class="btn danger"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppLogout()}
          >
            Logout
          </button>
          <button class="btn" @click=${() => props.onRefresh(true)}>
            Refresh
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Telegram</div>
        <div class="card-sub">Bot token and delivery options.</div>

        <div class="status-list" style="margin-top: 16px;">
          <div>
            <span class="label">Configured</span>
            <span>${telegram?.configured ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Running</span>
            <span>${telegram?.running ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Mode</span>
            <span>${telegram?.mode ?? "n/a"}</span>
          </div>
          <div>
            <span class="label">Last start</span>
            <span>${telegram?.lastStartAt ? formatAgo(telegram.lastStartAt) : "n/a"}</span>
          </div>
          <div>
            <span class="label">Last probe</span>
            <span>${telegram?.lastProbeAt ? formatAgo(telegram.lastProbeAt) : "n/a"}</span>
          </div>
        </div>

        ${telegram?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${telegram.lastError}
            </div>`
          : nothing}

        ${telegram?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              Probe ${telegram.probe.ok ? "ok" : "failed"} ·
              ${telegram.probe.status ?? ""}
              ${telegram.probe.error ?? ""}
            </div>`
          : nothing}

        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Bot token</span>
            <input
              type="password"
              .value=${props.telegramForm.token}
              ?disabled=${props.telegramTokenLocked}
              @input=${(e: Event) =>
                props.onTelegramChange({
                  token: (e.target as HTMLInputElement).value,
                })}
            />
          </label>
          <label class="field">
            <span>Require mention</span>
            <select
              .value=${props.telegramForm.requireMention ? "yes" : "no"}
              @change=${(e: Event) =>
                props.onTelegramChange({
                  requireMention: (e.target as HTMLSelectElement).value === "yes",
                })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label class="field">
            <span>Allow from</span>
            <input
              .value=${props.telegramForm.allowFrom}
              @input=${(e: Event) =>
                props.onTelegramChange({
                  allowFrom: (e.target as HTMLInputElement).value,
                })}
              placeholder="123456789, @team"
            />
          </label>
          <label class="field">
            <span>Proxy</span>
            <input
              .value=${props.telegramForm.proxy}
              @input=${(e: Event) =>
                props.onTelegramChange({
                  proxy: (e.target as HTMLInputElement).value,
                })}
              placeholder="socks5://localhost:9050"
            />
          </label>
          <label class="field">
            <span>Webhook URL</span>
            <input
              .value=${props.telegramForm.webhookUrl}
              @input=${(e: Event) =>
                props.onTelegramChange({
                  webhookUrl: (e.target as HTMLInputElement).value,
                })}
              placeholder="https://example.com/telegram-webhook"
            />
          </label>
          <label class="field">
            <span>Webhook secret</span>
            <input
              .value=${props.telegramForm.webhookSecret}
              @input=${(e: Event) =>
                props.onTelegramChange({
                  webhookSecret: (e.target as HTMLInputElement).value,
                })}
              placeholder="secret"
            />
          </label>
          <label class="field">
            <span>Webhook path</span>
            <input
              .value=${props.telegramForm.webhookPath}
              @input=${(e: Event) =>
                props.onTelegramChange({
                  webhookPath: (e.target as HTMLInputElement).value,
                })}
              placeholder="/telegram-webhook"
            />
          </label>
        </div>

        ${props.telegramTokenLocked
          ? html`<div class="callout" style="margin-top: 12px;">
              TELEGRAM_BOT_TOKEN is set in the environment. Config edits will not override it.
            </div>`
          : nothing}

        ${props.telegramStatus
          ? html`<div class="callout" style="margin-top: 12px;">
              ${props.telegramStatus}
            </div>`
          : nothing}

        <div class="row" style="margin-top: 14px;">
          <button
            class="btn primary"
            ?disabled=${props.telegramSaving}
            @click=${() => props.onTelegramSave()}
          >
            ${props.telegramSaving ? "Saving…" : "Save"}
          </button>
          <button class="btn" @click=${() => props.onRefresh(true)}>
            Probe
          </button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Connection health</div>
          <div class="card-sub">Provider status snapshots from the gateway.</div>
        </div>
        <div class="muted">${props.lastSuccessAt ? formatAgo(props.lastSuccessAt) : "n/a"}</div>
      </div>
      ${props.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${props.lastError}
          </div>`
        : nothing}
      <pre class="code-block" style="margin-top: 12px;">
${props.snapshot ? JSON.stringify(props.snapshot, null, 2) : "No snapshot yet."}
      </pre>
    </section>
  `;
}

function formatDuration(ms?: number | null) {
  if (!ms && ms !== 0) return "n/a";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  return `${hr}h`;
}
