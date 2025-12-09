var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { renderTool } from "../tools/index.js";
import { formatUsage } from "../utils/format.js";
import { i18n } from "../utils/i18n.js";
import { formatClock, renderSurfaceChip } from "../utils/message-meta.js";
import "./ThinkingBlock.js";
let UserMessage = class UserMessage extends LitElement {
    createRenderRoot() {
        return this;
    }
    connectedCallback() {
        super.connectedCallback();
        this.style.display = "block";
    }
    render() {
        const content = typeof this.message.content === "string"
            ? this.message.content
            : this.message.content.find((c) => c.type === "text")?.text || "";
        return html `
			<div class="px-4 mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
				${renderSurfaceChip(this.message.surface, this.message.senderHost, this.message.senderIp)}
				<span class="opacity-70">${formatClock(this.message.timestamp)}</span>
			</div>
			<div class="flex justify-start mx-4">
				<div class="user-message-container py-2 px-4 rounded-xl">
					<markdown-block .content=${content}></markdown-block>
					${this.message.attachments && this.message.attachments.length > 0
            ? html `
								<div class="mt-3 flex flex-wrap gap-2">
									${this.message.attachments.map((attachment) => html ` <attachment-tile .attachment=${attachment}></attachment-tile> `)}
								</div>
							`
            : ""}
				</div>
			</div>
		`;
    }
};
__decorate([
    property({ type: Object })
], UserMessage.prototype, "message", void 0);
UserMessage = __decorate([
    customElement("user-message")
], UserMessage);
export { UserMessage };
let AssistantMessage = class AssistantMessage extends LitElement {
    constructor() {
        super(...arguments);
        this.hideToolCalls = false;
        this.isStreaming = false;
    }
    createRenderRoot() {
        return this;
    }
    connectedCallback() {
        super.connectedCallback();
        this.style.display = "block";
    }
    render() {
        // Render content in the order it appears
        const orderedParts = [];
        for (const chunk of this.message.content) {
            if (chunk.type === "text" && chunk.text.trim() !== "") {
                orderedParts.push(html `<markdown-block .content=${chunk.text}></markdown-block>`);
            }
            else if (chunk.type === "thinking" && chunk.thinking.trim() !== "") {
                orderedParts.push(html `<thinking-block .content=${chunk.thinking} .isStreaming=${this.isStreaming}></thinking-block>`);
            }
            else if (chunk.type === "toolCall") {
                if (!this.hideToolCalls) {
                    const tool = this.tools?.find((t) => t.name === chunk.name);
                    const pending = this.pendingToolCalls?.has(chunk.id) ?? false;
                    const result = this.toolResultsById?.get(chunk.id);
                    // A tool call is aborted if the message was aborted and there's no result for this tool call
                    const aborted = this.message.stopReason === "aborted" && !result;
                    orderedParts.push(html `<tool-message
							.tool=${tool}
							.toolCall=${chunk}
							.result=${result}
							.pending=${pending}
							.aborted=${aborted}
							.isStreaming=${this.isStreaming}
						></tool-message>`);
                }
            }
        }
        return html `
			<div>
				${orderedParts.length ? html ` <div class="px-4 flex flex-col gap-3">${orderedParts}</div> ` : ""}
				${this.message.usage && !this.isStreaming
            ? this.onCostClick
                ? html ` <div class="px-4 mt-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" @click=${this.onCostClick}>${formatUsage(this.message.usage)}</div> `
                : html ` <div class="px-4 mt-2 text-xs text-muted-foreground">${formatUsage(this.message.usage)}</div> `
            : ""}
				${this.message.stopReason === "error" && this.message.errorMessage
            ? html `
							<div class="mx-4 mt-3 p-3 bg-destructive/10 text-destructive rounded-lg text-sm overflow-hidden">
								<strong>${i18n("Error:")}</strong> ${this.message.errorMessage}
							</div>
						`
            : ""}
				${this.message.stopReason === "aborted"
            ? html `<span class="text-sm text-destructive italic">${i18n("Request aborted")}</span>`
            : ""}
			</div>
		`;
    }
};
__decorate([
    property({ type: Object })
], AssistantMessage.prototype, "message", void 0);
__decorate([
    property({ type: Array })
], AssistantMessage.prototype, "tools", void 0);
__decorate([
    property({ type: Object })
], AssistantMessage.prototype, "pendingToolCalls", void 0);
__decorate([
    property({ type: Boolean })
], AssistantMessage.prototype, "hideToolCalls", void 0);
__decorate([
    property({ type: Object })
], AssistantMessage.prototype, "toolResultsById", void 0);
__decorate([
    property({ type: Boolean })
], AssistantMessage.prototype, "isStreaming", void 0);
__decorate([
    property({ attribute: false })
], AssistantMessage.prototype, "onCostClick", void 0);
AssistantMessage = __decorate([
    customElement("assistant-message")
], AssistantMessage);
export { AssistantMessage };
let ToolMessageDebugView = class ToolMessageDebugView extends LitElement {
    constructor() {
        super(...arguments);
        this.hasResult = false;
    }
    createRenderRoot() {
        return this; // light DOM for shared styles
    }
    connectedCallback() {
        super.connectedCallback();
        this.style.display = "block";
    }
    pretty(value) {
        try {
            if (typeof value === "string") {
                const maybeJson = JSON.parse(value);
                return { content: JSON.stringify(maybeJson, null, 2), isJson: true };
            }
            return { content: JSON.stringify(value, null, 2), isJson: true };
        }
        catch {
            return { content: typeof value === "string" ? value : String(value), isJson: false };
        }
    }
    render() {
        const textOutput = this.result?.content
            ?.filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n") || "";
        const output = this.pretty(textOutput);
        const details = this.pretty(this.result?.details);
        return html `
			<div class="mt-3 flex flex-col gap-2">
				<div>
					<div class="text-xs font-medium mb-1 text-muted-foreground">${i18n("Call")}</div>
					<code-block .code=${this.pretty(this.callArgs).content} language="json"></code-block>
				</div>
				<div>
					<div class="text-xs font-medium mb-1 text-muted-foreground">${i18n("Result")}</div>
					${this.hasResult
            ? html `<code-block .code=${output.content} language="${output.isJson ? "json" : "text"}"></code-block>
								<code-block .code=${details.content} language="${details.isJson ? "json" : "text"}"></code-block>`
            : html `<div class="text-xs text-muted-foreground">${i18n("(no result)")}</div>`}
				</div>
			</div>
		`;
    }
};
__decorate([
    property({ type: Object })
], ToolMessageDebugView.prototype, "callArgs", void 0);
__decorate([
    property({ type: Object })
], ToolMessageDebugView.prototype, "result", void 0);
__decorate([
    property({ type: Boolean })
], ToolMessageDebugView.prototype, "hasResult", void 0);
ToolMessageDebugView = __decorate([
    customElement("tool-message-debug")
], ToolMessageDebugView);
export { ToolMessageDebugView };
let ToolMessage = class ToolMessage extends LitElement {
    constructor() {
        super(...arguments);
        this.pending = false;
        this.aborted = false;
        this.isStreaming = false;
    }
    createRenderRoot() {
        return this;
    }
    connectedCallback() {
        super.connectedCallback();
        this.style.display = "block";
    }
    render() {
        const toolName = this.tool?.name || this.toolCall.name;
        // Render tool content (renderer handles errors and styling)
        const result = this.aborted
            ? {
                role: "toolResult",
                isError: true,
                content: [],
                toolCallId: this.toolCall.id,
                toolName: this.toolCall.name,
                timestamp: Date.now(),
            }
            : this.result;
        const renderResult = renderTool(toolName, this.toolCall.arguments, result, !this.aborted && (this.isStreaming || this.pending));
        // Handle custom rendering (no card wrapper)
        if (renderResult.isCustom) {
            return renderResult.content;
        }
        // Default: wrap in card
        return html `
			<div class="p-2.5 border border-border rounded-md bg-card text-card-foreground shadow-xs">
				${renderResult.content}
			</div>
		`;
    }
};
__decorate([
    property({ type: Object })
], ToolMessage.prototype, "toolCall", void 0);
__decorate([
    property({ type: Object })
], ToolMessage.prototype, "tool", void 0);
__decorate([
    property({ type: Object })
], ToolMessage.prototype, "result", void 0);
__decorate([
    property({ type: Boolean })
], ToolMessage.prototype, "pending", void 0);
__decorate([
    property({ type: Boolean })
], ToolMessage.prototype, "aborted", void 0);
__decorate([
    property({ type: Boolean })
], ToolMessage.prototype, "isStreaming", void 0);
ToolMessage = __decorate([
    customElement("tool-message")
], ToolMessage);
export { ToolMessage };
let AbortedMessage = class AbortedMessage extends LitElement {
    createRenderRoot() {
        return this;
    }
    connectedCallback() {
        super.connectedCallback();
        this.style.display = "block";
    }
    render() {
        return html `<span class="text-sm text-destructive italic">${i18n("Request aborted")}</span>`;
    }
};
AbortedMessage = __decorate([
    customElement("aborted-message")
], AbortedMessage);
export { AbortedMessage };
//# sourceMappingURL=Messages.js.map
