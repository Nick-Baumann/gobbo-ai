import { html, nothing } from "lit";

export type ConfigProps = {
  raw: string;
  valid: boolean | null;
  issues: unknown[];
  loading: boolean;
  saving: boolean;
  connected: boolean;
  onRawChange: (next: string) => void;
  onReload: () => void;
  onSave: () => void;
};

export function renderConfig(props: ConfigProps) {
  const validity =
    props.valid == null ? "unknown" : props.valid ? "valid" : "invalid";
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div class="row">
          <div class="card-title">Config</div>
          <span class="pill">${validity}</span>
        </div>
        <div class="row">
          <button class="btn" ?disabled=${props.loading} @click=${props.onReload}>
            ${props.loading ? "Loading…" : "Reload"}
          </button>
          <button
            class="btn primary"
            ?disabled=${props.saving || !props.connected}
            @click=${props.onSave}
          >
            ${props.saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div class="muted" style="margin-top: 10px;">
        Writes to <span class="mono">~/.clawdis/clawdis.json</span>. Some changes
        require a gateway restart.
      </div>

      <label class="field" style="margin-top: 12px;">
        <span>Raw JSON5</span>
        <textarea
          .value=${props.raw}
          @input=${(e: Event) =>
            props.onRawChange((e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </label>

      ${props.issues.length > 0
        ? html`<div class="callout danger" style="margin-top: 12px;">
            <pre class="code-block">${JSON.stringify(props.issues, null, 2)}</pre>
          </div>`
        : nothing}
    </section>
  `;
}

