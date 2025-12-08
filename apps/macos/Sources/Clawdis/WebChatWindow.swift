import AppKit
import Foundation
import Network
import OSLog
import WebKit

private let webChatLogger = Logger(subsystem: "com.steipete.clawdis", category: "WebChat")

final class WebChatWindowController: NSWindowController, WKNavigationDelegate {
    private let webView: WKWebView
    private let sessionKey: String
    private var tunnel: WebChatTunnel?
    private var baseEndpoint: URL?

    init(sessionKey: String) {
        webChatLogger.debug("init WebChatWindowController sessionKey=\(sessionKey, privacy: .public)")
        self.sessionKey = sessionKey

        let config = WKWebViewConfiguration()
        let contentController = WKUserContentController()
        config.userContentController = contentController
        config.preferences.isElementFullscreenEnabled = true
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        self.webView = WKWebView(frame: .zero, configuration: config)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 960, height: 720),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false)
        window.title = "Clawd Web Chat"
        window.contentView = self.webView
        super.init(window: window)
        self.webView.navigationDelegate = self

        self.loadPlaceholder()
        Task { await self.bootstrap() }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private func loadPlaceholder() {
        let html = """
        <html><body style='font-family:-apple-system;padding:24px;color:#888'>Connecting to web chat…</body></html>
        """
        self.webView.loadHTMLString(html, baseURL: nil)
    }

    private func loadPage(baseURL: URL) {
        self.webView.load(URLRequest(url: baseURL))
        webChatLogger.debug("loadPage url=\(baseURL.absoluteString, privacy: .public)")
    }

    // MARK: - Bootstrap

    private func bootstrap() async {
        do {
            guard AppStateStore.webChatEnabled else {
                throw NSError(domain: "WebChat", code: 5, userInfo: [NSLocalizedDescriptionKey: "Web chat disabled in settings"])
            }
            let endpoint = try await self.prepareEndpoint(remotePort: AppStateStore.webChatPort)
            self.baseEndpoint = endpoint
            await MainActor.run {
                var comps = URLComponents(url: endpoint.appendingPathComponent("webchat/"), resolvingAgainstBaseURL: false)
                comps?.queryItems = [URLQueryItem(name: "session", value: self.sessionKey)]
                if let url = comps?.url {
                    self.loadPage(baseURL: url)
                } else {
                    self.showError("invalid webchat url")
                }
            }
        } catch {
            let message = error.localizedDescription
            webChatLogger.error("webchat bootstrap failed: \(message, privacy: .public)")
            await MainActor.run { self.showError(message) }
        }
    }

    private func prepareEndpoint(remotePort: Int) async throws -> URL {
        if CommandResolver.connectionModeIsRemote() {
            let tunnel = try await WebChatTunnel.create(remotePort: remotePort)
            self.tunnel = tunnel
            guard let port = tunnel.localPort else {
                throw NSError(domain: "WebChat", code: 2, userInfo: [NSLocalizedDescriptionKey: "tunnel missing port"])
            }
            return URL(string: "http://127.0.0.1:\(port)/")!
        } else {
            return URL(string: "http://127.0.0.1:\(remotePort)/")!
        }
    }

    private func showError(_ text: String) {
        let html = """
        <html><body style='font-family:-apple-system;padding:24px;color:#c00'>Web chat failed to connect.<br><br>\(text)</body></html>
        """
        self.webView.loadHTMLString(html, baseURL: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webChatLogger.debug("didFinish navigation url=\(webView.url?.absoluteString ?? "nil", privacy: .public)")
    }
}

// MARK: - Manager

@MainActor
final class WebChatManager {
    static let shared = WebChatManager()
    private var controller: WebChatWindowController?

    func show(sessionKey: String) {
        if self.controller == nil {
            self.controller = WebChatWindowController(sessionKey: sessionKey)
        }
        self.controller?.showWindow(nil)
        self.controller?.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

// MARK: - Port forwarding tunnel

final class WebChatTunnel {
    let process: Process
    let localPort: UInt16?

    private init(process: Process, localPort: UInt16?) {
        self.process = process
        self.localPort = localPort
    }

    deinit {
        self.process.terminate()
    }

    static func create(remotePort: Int) async throws -> WebChatTunnel {
        let settings = CommandResolver.connectionSettings()
        guard settings.mode == .remote, let parsed = VoiceWakeForwarder.parse(target: settings.target) else {
            throw NSError(domain: "WebChat", code: 3, userInfo: [NSLocalizedDescriptionKey: "remote not configured"])
        }

        let localPort = try Self.findFreePort()
        var args: [String] = ["-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-N", "-L", "\(localPort):127.0.0.1:\(remotePort)"]
        if parsed.port > 0 { args.append(contentsOf: ["-p", String(parsed.port)]) }
        let identity = settings.identity.trimmingCharacters(in: .whitespacesAndNewlines)
        if !identity.isEmpty { args.append(contentsOf: ["-i", identity]) }
        let userHost = parsed.user.map { "\($0)@\(parsed.host)" } ?? parsed.host
        args.append(userHost)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/ssh")
        process.arguments = args
        let pipe = Pipe()
        process.standardError = pipe
        try process.run()

        return WebChatTunnel(process: process, localPort: localPort)
    }

    private static func findFreePort() throws -> UInt16 {
        let listener = try NWListener(using: .tcp, on: .any)
        listener.start(queue: .main)
        while listener.port == nil {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
        }
        let port = listener.port?.rawValue
        listener.cancel()
        guard let port else { throw NSError(domain: "WebChat", code: 4, userInfo: [NSLocalizedDescriptionKey: "no port"])}
        return port
    }
}

extension URL {
    func appending(queryItems: [URLQueryItem]) -> URL {
        guard var comps = URLComponents(url: self, resolvingAgainstBaseURL: false) else { return self }
        comps.queryItems = (comps.queryItems ?? []) + queryItems
        return comps.url ?? self
    }
}
