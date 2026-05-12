import Foundation

extension OnboardingView {
    func loadWorkspaceDefaults() {
        guard self.workspacePath.isEmpty else { return }
        let configured = GobboConfigFile.agentWorkspace()
        let url = AgentWorkspace.resolveWorkspaceURL(from: configured)
        self.workspacePath = AgentWorkspace.displayPath(for: url)
        self.refreshBootstrapStatus()
    }

    func ensureDefaultWorkspace() {
        guard self.state.connectionMode == .local else { return }
        let configured = GobboConfigFile.agentWorkspace()
        let url = AgentWorkspace.resolveWorkspaceURL(from: configured)
        switch AgentWorkspace.bootstrapSafety(for: url) {
        case .safe:
            do {
                _ = try AgentWorkspace.bootstrap(workspaceURL: url)
                if (configured ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    GobboConfigFile.setAgentWorkspace(AgentWorkspace.displayPath(for: url))
                }
            } catch {
                self.workspaceStatus = "Failed to create workspace: \(error.localizedDescription)"
            }
        case let .unsafe(reason):
            self.workspaceStatus = "Workspace not touched: \(reason)"
        }
        self.refreshBootstrapStatus()
    }

    func refreshBootstrapStatus() {
        let url = AgentWorkspace.resolveWorkspaceURL(from: self.workspacePath)
        self.needsBootstrap = AgentWorkspace.needsBootstrap(workspaceURL: url)
        if self.needsBootstrap {
            self.didAutoKickoff = false
        }
    }

    var workspaceBootstrapCommand: String {
        let template = AgentWorkspace.defaultTemplate().trimmingCharacters(in: .whitespacesAndNewlines)
        return """
        mkdir -p ~/.gobbo/workspace
        cat > ~/.gobbo/workspace/AGENTS.md <<'EOF'
        \(template)
        EOF
        """
    }

    func applyWorkspace() async {
        guard !self.workspaceApplying else { return }
        self.workspaceApplying = true
        defer { self.workspaceApplying = false }

        do {
            let url = AgentWorkspace.resolveWorkspaceURL(from: self.workspacePath)
            if case let .unsafe(reason) = AgentWorkspace.bootstrapSafety(for: url) {
                self.workspaceStatus = "Workspace not created: \(reason)"
                return
            }
            _ = try AgentWorkspace.bootstrap(workspaceURL: url)
            self.workspacePath = AgentWorkspace.displayPath(for: url)
            self.workspaceStatus = "Workspace ready at \(self.workspacePath)"
            self.refreshBootstrapStatus()
        } catch {
            self.workspaceStatus = "Failed to create workspace: \(error.localizedDescription)"
        }
    }
}
