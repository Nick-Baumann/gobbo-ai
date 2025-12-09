import { html } from "lit";
import { i18n } from "./i18n.js";

export function formatClock(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const palette = {
  whatsapp: { label: "WhatsApp", class: "bg-emerald-600" },
  telegram: { label: "Telegram", class: "bg-sky-600" },
  webchat: { label: "WebChat", class: "bg-indigo-500" },
  computer: { label: "Computer", class: "bg-slate-600" },
};

export function renderSurfaceChip(surface, senderHost, senderIp) {
  const key = (surface || "computer").toLowerCase();
  const meta = palette[key] ?? { label: surface || i18n("Unknown"), class: "bg-slate-500" };
  const hostPart = senderHost ? ` • ${senderHost}` : "";
  const ipPart = senderIp ? ` (${senderIp})` : "";

  return html`<span class="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] font-semibold text-white ${meta.class}">
      ${meta.label}${hostPart}${ipPart}
    </span>`;
}

