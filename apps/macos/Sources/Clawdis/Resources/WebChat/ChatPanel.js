var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Badge } from "@mariozechner/mini-lit/dist/Badge.js";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./components/AgentInterface.js";
import { ArtifactsRuntimeProvider } from "./components/sandbox/ArtifactsRuntimeProvider.js";
import { AttachmentsRuntimeProvider } from "./components/sandbox/AttachmentsRuntimeProvider.js";
import { ArtifactsPanel, ArtifactsToolRenderer } from "./tools/artifacts/index.js";
import { registerToolRenderer } from "./tools/renderer-registry.js";
import { i18n } from "./utils/i18n.js";
const BREAKPOINT = 800; // px - switch between overlay and side-by-side
let ChatPanel = class ChatPanel extends LitElement {
    constructor() {
        super(...arguments);
        this.hasArtifacts = false;
        this.artifactCount = 0;
        this.showArtifactsPanel = false;
        this.windowWidth = 0;
        this.resizeHandler = () => {
            this.windowWidth = window.innerWidth;
            this.requestUpdate();
        };
    }
    createRenderRoot() {
        return this;
    }
    connectedCallback() {
        super.connectedCallback();
        this.windowWidth = window.innerWidth; // Set initial width after connection
        window.addEventListener("resize", this.resizeHandler);
        this.style.display = "flex";
        this.style.flexDirection = "column";
        this.style.height = "100%";
        this.style.minHeight = "0";
        // Update width after initial render
        requestAnimationFrame(() => {
            this.windowWidth = window.innerWidth;
            this.requestUpdate();
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("resize", this.resizeHandler);
    }
    async setAgent(agent, config) {
        this.agent = agent;
        // Create AgentInterface
        this.agentInterface = document.createElement("agent-interface");
        this.agentInterface.session = agent;
        this.agentInterface.enableAttachments = true;
        // Hide model selector in the embedded chat; use fixed model configured at bootstrap.
        this.agentInterface.enableModelSelector = false;
        this.agentInterface.enableThinkingSelector = true;
        this.agentInterface.showThemeToggle = false;
        this.agentInterface.onApiKeyRequired = config?.onApiKeyRequired;
        this.agentInterface.onBeforeSend = config?.onBeforeSend;
        this.agentInterface.onCostClick = config?.onCostClick;
        // Set up artifacts panel
        this.artifactsPanel = new ArtifactsPanel();
        this.artifactsPanel.agent = agent; // Pass agent for HTML artifact runtime providers
        if (config?.sandboxUrlProvider) {
            this.artifactsPanel.sandboxUrlProvider = config.sandboxUrlProvider;
        }
        // Register the standalone tool renderer (not the panel itself)
        registerToolRenderer("artifacts", new ArtifactsToolRenderer(this.artifactsPanel));
        // Runtime providers factory for REPL tools (read-write access)
        const runtimeProvidersFactory = () => {
            const attachments = [];
            for (const message of this.agent.state.messages) {
                if (message.role === "user") {
                    message.attachments?.forEach((a) => {
                        attachments.push(a);
                    });
                }
            }
            const providers = [];
            // Add attachments provider if there are attachments
            if (attachments.length > 0) {
                providers.push(new AttachmentsRuntimeProvider(attachments));
            }
            // Add artifacts provider with read-write access (for REPL)
            providers.push(new ArtifactsRuntimeProvider(this.artifactsPanel, this.agent, true));
            return providers;
        };
        this.artifactsPanel.onArtifactsChange = () => {
            const count = this.artifactsPanel?.artifacts?.size ?? 0;
            const created = count > this.artifactCount;
            this.hasArtifacts = count > 0;
            this.artifactCount = count;
            if (this.hasArtifacts && created) {
                this.showArtifactsPanel = true;
            }
            this.requestUpdate();
        };
        this.artifactsPanel.onClose = () => {
            this.showArtifactsPanel = false;
            this.requestUpdate();
        };
        this.artifactsPanel.onOpen = () => {
            this.showArtifactsPanel = true;
            this.requestUpdate();
        };
        // Set tools on the agent
        // Pass runtimeProvidersFactory so consumers can configure their own REPL tools
        const additionalTools = config?.toolsFactory?.(agent, this.agentInterface, this.artifactsPanel, runtimeProvidersFactory) || [];
        const tools = [this.artifactsPanel.tool, ...additionalTools];
        this.agent.setTools(tools);
        // Reconstruct artifacts from existing messages
        // Temporarily disable the onArtifactsChange callback to prevent auto-opening on load
        const originalCallback = this.artifactsPanel.onArtifactsChange;
        this.artifactsPanel.onArtifactsChange = undefined;
        await this.artifactsPanel.reconstructFromMessages(this.agent.state.messages);
        this.artifactsPanel.onArtifactsChange = originalCallback;
        this.hasArtifacts = this.artifactsPanel.artifacts.size > 0;
        this.artifactCount = this.artifactsPanel.artifacts.size;
        this.requestUpdate();
    }
    render() {
        if (!this.agent || !this.agentInterface) {
            return html `<div class="flex items-center justify-center h-full">
				<div class="text-muted-foreground">No agent set</div>
			</div>`;
        }
        const isMobile = this.windowWidth < BREAKPOINT;
        // Set panel props
        if (this.artifactsPanel) {
            this.artifactsPanel.collapsed = !this.showArtifactsPanel;
            this.artifactsPanel.overlay = isMobile;
        }
        return html `
			<div class="relative w-full h-full overflow-hidden flex">
				<div class="h-full" style="${!isMobile && this.showArtifactsPanel && this.hasArtifacts ? "width: 50%;" : "width: 100%;"}">
						${this.agentInterface}
					</div>

					<!-- Floating pill when artifacts exist and panel is collapsed -->
					${this.hasArtifacts && !this.showArtifactsPanel
            ? html `
								<button
									class="absolute z-30 top-4 left-1/2 -translate-x-1/2 pointer-events-auto"
									@click=${() => {
                this.showArtifactsPanel = true;
                this.requestUpdate();
            }}
									title=${i18n("Show artifacts")}
								>
									${Badge(html `
										<span class="inline-flex items-center gap-1">
											<span>${i18n("Artifacts")}</span>
											<span class="text-[10px] leading-none bg-primary-foreground/20 text-primary-foreground rounded px-1 font-mono tabular-nums">${this.artifactCount}</span>
										</span>
									`)}
								</button>
							`
            : ""}

				<div class="h-full ${isMobile ? "absolute inset-0 pointer-events-none" : ""}" style="${!isMobile ? (!this.hasArtifacts || !this.showArtifactsPanel ? "display: none;" : "width: 50%;") : ""}">
					${this.artifactsPanel}
				</div>
			</div>
		`;
    }
};
__decorate([
    state()
], ChatPanel.prototype, "agent", void 0);
__decorate([
    state()
], ChatPanel.prototype, "agentInterface", void 0);
__decorate([
    state()
], ChatPanel.prototype, "artifactsPanel", void 0);
__decorate([
    state()
], ChatPanel.prototype, "hasArtifacts", void 0);
__decorate([
    state()
], ChatPanel.prototype, "artifactCount", void 0);
__decorate([
    state()
], ChatPanel.prototype, "showArtifactsPanel", void 0);
__decorate([
    state()
], ChatPanel.prototype, "windowWidth", void 0);
ChatPanel = __decorate([
    customElement("pi-chat-panel")
], ChatPanel);
export { ChatPanel };
//# sourceMappingURL=ChatPanel.js.map
