import Darwin
import Foundation

enum BrowserCLI {
    private static let defaultControlURL = "http://127.0.0.1:18791"

    static func run(args: [String], jsonOutput: Bool) async throws -> Int32 {
        var args = args
        guard let sub = args.first else {
            self.printHelp()
            return 0
        }
        args = Array(args.dropFirst())

        if sub == "--help" || sub == "-h" || sub == "help" {
            self.printHelp()
            return 0
        }

        var overrideURL: String?
        var fullPage = false
        var targetId: String?
        var awaitPromise = false
        var js: String?
        var jsFile: String?
        var jsStdin = false
        var selector: String?
        var format: String?
        var limit: Int?
        var maxChars: Int?
        var outPath: String?
        var rest: [String] = []

        while !args.isEmpty {
            let arg = args.removeFirst()
            switch arg {
            case "--url":
                overrideURL = args.popFirst()
            case "--full-page":
                fullPage = true
            case "--target-id":
                targetId = args.popFirst()
            case "--await":
                awaitPromise = true
            case "--js":
                js = args.popFirst()
            case "--js-file":
                jsFile = args.popFirst()
            case "--js-stdin":
                jsStdin = true
            case "--selector":
                selector = args.popFirst()
            case "--format":
                format = args.popFirst()
            case "--limit":
                limit = args.popFirst().flatMap(Int.init)
            case "--max-chars":
                maxChars = args.popFirst().flatMap(Int.init)
            case "--out":
                outPath = args.popFirst()
            default:
                rest.append(arg)
            }
        }

        let cfg = self.loadBrowserConfig()
        guard cfg.enabled else {
            if jsonOutput {
                self.printJSON(ok: false, result: ["error": "browser control disabled"])
            } else {
                print("Browser control is disabled in ~/.clawdis/clawdis.json (browser.enabled=false).")
            }
            return 1
        }

        let base = (overrideURL ?? cfg.controlUrl).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let baseURL = URL(string: base) else {
            throw NSError(domain: "BrowserCLI", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Invalid browser control URL: \(base)",
            ])
        }

        do {
            switch sub {
            case "status":
                try await self.printResult(
                    jsonOutput: jsonOutput,
                    res: self.httpJSON(method: "GET", url: baseURL.appendingPathComponent("/")))
                return 0

            case "start":
                try await self.printResult(
                    jsonOutput: jsonOutput,
                    res: self.httpJSON(
                        method: "POST",
                        url: baseURL.appendingPathComponent("/start"),
                        timeoutInterval: 15.0))
                return 0

            case "stop":
                try await self.printResult(
                    jsonOutput: jsonOutput,
                    res: self.httpJSON(
                        method: "POST",
                        url: baseURL.appendingPathComponent("/stop"),
                        timeoutInterval: 15.0))
                return 0

            case "tabs":
                let res = try await self.httpJSON(
                    method: "GET",
                    url: baseURL.appendingPathComponent("/tabs"),
                    timeoutInterval: 3.0)
                if jsonOutput {
                    self.printJSON(ok: true, result: res)
                } else {
                    self.printTabs(res: res)
                }
                return 0

            case "open":
                guard let url = rest.first, !url.isEmpty else {
                    self.printHelp()
                    return 2
                }
                try await self.printResult(
                    jsonOutput: jsonOutput,
                    res: self.httpJSON(
                        method: "POST",
                        url: baseURL.appendingPathComponent("/tabs/open"),
                        body: ["url": url],
                        timeoutInterval: 15.0))
                return 0

            case "focus":
                guard let id = rest.first, !id.isEmpty else {
                    self.printHelp()
                    return 2
                }
                try await self.printResult(
                    jsonOutput: jsonOutput,
                    res: self.httpJSON(
                        method: "POST",
                        url: baseURL.appendingPathComponent("/tabs/focus"),
                        body: ["targetId": id],
                        timeoutInterval: 5.0))
                return 0

            case "close":
                guard let id = rest.first, !id.isEmpty else {
                    self.printHelp()
                    return 2
                }
                try await self.printResult(
                    jsonOutput: jsonOutput,
                    res: self.httpJSON(
                        method: "DELETE",
                        url: baseURL.appendingPathComponent("/tabs/\(id)"),
                        timeoutInterval: 5.0))
                return 0

            case "screenshot":
                var url = baseURL.appendingPathComponent("/screenshot")
                var items: [URLQueryItem] = []
                if let targetId, !targetId.isEmpty {
                    items.append(URLQueryItem(name: "targetId", value: targetId))
                }
                if fullPage {
                    items.append(URLQueryItem(name: "fullPage", value: "1"))
                }
                if !items.isEmpty {
                    url = self.withQuery(url, items: items)
                }
                let res = try await self.httpJSON(method: "GET", url: url, timeoutInterval: 20.0)
                if jsonOutput {
                    self.printJSON(ok: true, result: res)
                } else if let path = res["path"] as? String, !path.isEmpty {
                    print("MEDIA:\(path)")
                } else {
                    self.printResult(jsonOutput: false, res: res)
                }
                return 0

            case "eval":
                if jsStdin, jsFile != nil {
                    self.printHelp()
                    return 2
                }

                let code: String = try {
                    if let jsFile, !jsFile.isEmpty {
                        return try String(contentsOfFile: jsFile, encoding: .utf8)
                    }
                    if jsStdin {
                        let data = FileHandle.standardInput.readDataToEndOfFile()
                        return String(data: data, encoding: .utf8) ?? ""
                    }
                    if let js, !js.isEmpty { return js }
                    if !rest.isEmpty { return rest.joined(separator: " ") }
                    return ""
                }()

                if code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self.printHelp()
                    return 2
                }

                let res = try await self.httpJSON(
                    method: "POST",
                    url: baseURL.appendingPathComponent("/eval"),
                    body: [
                        "js": code,
                        "targetId": targetId ?? "",
                        "await": awaitPromise,
                    ],
                    timeoutInterval: 15.0)

                if jsonOutput {
                    self.printJSON(ok: true, result: res)
                } else {
                    self.printEval(res: res)
                }
                return 0

            case "query":
                let sel = (selector ?? rest.first ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if sel.isEmpty {
                    self.printHelp()
                    return 2
                }
                var url = baseURL.appendingPathComponent("/query")
                var items: [URLQueryItem] = [URLQueryItem(name: "selector", value: sel)]
                if let targetId, !targetId.isEmpty {
                    items.append(URLQueryItem(name: "targetId", value: targetId))
                }
                if let limit, limit > 0 {
                    items.append(URLQueryItem(name: "limit", value: String(limit)))
                }
                url = self.withQuery(url, items: items)
                let res = try await self.httpJSON(method: "GET", url: url, timeoutInterval: 15.0)
                if jsonOutput || format == "json" {
                    self.printJSON(ok: true, result: res)
                } else {
                    self.printQuery(res: res)
                }
                return 0

            case "dom":
                let fmt = (format == "text") ? "text" : "html"
                var url = baseURL.appendingPathComponent("/dom")
                var items: [URLQueryItem] = [URLQueryItem(name: "format", value: fmt)]
                if let targetId, !targetId.isEmpty {
                    items.append(URLQueryItem(name: "targetId", value: targetId))
                }
                if let selector = selector?.trimmingCharacters(in: .whitespacesAndNewlines), !selector.isEmpty {
                    items.append(URLQueryItem(name: "selector", value: selector))
                }
                if let maxChars, maxChars > 0 {
                    items.append(URLQueryItem(name: "maxChars", value: String(maxChars)))
                }
                url = self.withQuery(url, items: items)
                let res = try await self.httpJSON(method: "GET", url: url, timeoutInterval: 20.0)
                let text = (res["text"] as? String) ?? ""
                if let out = outPath, !out.isEmpty {
                    try Data(text.utf8).write(to: URL(fileURLWithPath: out))
                    if jsonOutput {
                        self.printJSON(ok: true, result: ["ok": true, "out": out])
                    } else {
                        print(out)
                    }
                    return 0
                }
                if jsonOutput {
                    self.printJSON(ok: true, result: res)
                } else {
                    print(text)
                }
                return 0

            case "snapshot":
                let fmt = (format == "domSnapshot") ? "domSnapshot" : "aria"
                var url = baseURL.appendingPathComponent("/snapshot")
                var items: [URLQueryItem] = [URLQueryItem(name: "format", value: fmt)]
                if let targetId, !targetId.isEmpty {
                    items.append(URLQueryItem(name: "targetId", value: targetId))
                }
                if let limit, limit > 0 {
                    items.append(URLQueryItem(name: "limit", value: String(limit)))
                }
                url = self.withQuery(url, items: items)
                let res = try await self.httpJSON(method: "GET", url: url, timeoutInterval: 20.0)

                if let out = outPath, !out.isEmpty {
                    let data = try JSONSerialization.data(withJSONObject: res, options: [.prettyPrinted])
                    try data.write(to: URL(fileURLWithPath: out))
                    if jsonOutput {
                        self.printJSON(ok: true, result: ["ok": true, "out": out])
                    } else {
                        print(out)
                    }
                    return 0
                }

                if jsonOutput || fmt == "domSnapshot" {
                    self.printJSON(ok: true, result: res)
                } else {
                    self.printSnapshotAria(res: res)
                }
                return 0

            default:
                self.printHelp()
                return 2
            }
        } catch {
            let msg = self.describeError(error, baseURL: baseURL)
            if jsonOutput {
                self.printJSON(ok: false, result: ["error": msg])
            } else {
                fputs("\(msg)\n", stderr)
            }
            return 1
        }
    }

    private struct BrowserConfig {
        let enabled: Bool
        let controlUrl: String
    }

    private static func loadBrowserConfig() -> BrowserConfig {
        let root = self.loadConfigDict()
        let browser = root["browser"] as? [String: Any]
        let enabled = browser?["enabled"] as? Bool ?? true
        let url = (browser?["controlUrl"] as? String) ?? self.defaultControlURL
        return BrowserConfig(enabled: enabled, controlUrl: url)
    }

    private static func loadConfigDict() -> [String: Any] {
        let url = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".clawdis")
            .appendingPathComponent("clawdis.json")
        guard let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private static func withQuery(_ url: URL, items: [URLQueryItem]) -> URL {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false) ?? URLComponents()
        components.queryItems = items
        return components.url ?? url
    }

    private static func httpJSON(
        method: String,
        url: URL,
        body: [String: Any]? = nil,
        timeoutInterval: TimeInterval = 2.0) async throws -> [String: Any]
    {
        var req = URLRequest(url: url, timeoutInterval: timeoutInterval)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        }

        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            throw self.wrapNetworkError(error, url: url, timeoutInterval: timeoutInterval)
        }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0

        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "BrowserCLI", code: status, userInfo: [
                NSLocalizedDescriptionKey: "HTTP \(status) \(method) \(url): \(text)",
            ])
        }

        if status >= 200, status < 300 {
            return obj
        }

        let msg = (obj["error"] as? String) ?? "HTTP \(status)"
        throw NSError(domain: "BrowserCLI", code: status, userInfo: [
            NSLocalizedDescriptionKey: msg,
        ])
    }

    private static func describeError(_ error: Error, baseURL: URL) -> String {
        let ns = error as NSError
        let msg = ns.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if !msg.isEmpty { return msg }
        return "Browser request failed (\(baseURL.absoluteString))"
    }

    private static func wrapNetworkError(_ error: Error, url: URL, timeoutInterval: TimeInterval) -> Error {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            // Keep this short: this often shows up inside SSH output and agent logs.
            switch ns.code {
            case NSURLErrorCannotConnectToHost, NSURLErrorNetworkConnectionLost, NSURLErrorTimedOut,
                 NSURLErrorCannotFindHost, NSURLErrorNotConnectedToInternet, NSURLErrorDNSLookupFailed:
                let base = url.absoluteString
                let hint = """
                Can't reach the clawd browser control server at \(base).
                Start (or restart) the Clawdis gateway (Clawdis.app menubar, or `clawdis gateway`) and try again.
                """
                return NSError(domain: "BrowserCLI", code: ns.code, userInfo: [
                    NSLocalizedDescriptionKey: hint,
                ])
            default:
                break
            }
        }
        let base = url.absoluteString
        let generic = "Failed to reach \(base) (timeout \(Int(timeoutInterval))s)."
        return NSError(domain: "BrowserCLI", code: ns.code, userInfo: [
            NSLocalizedDescriptionKey: generic,
        ])
    }

    private static func printResult(jsonOutput: Bool, res: [String: Any]) {
        if jsonOutput {
            self.printJSON(ok: true, result: res)
            return
        }
        if let text = res["message"] as? String, !text.isEmpty {
            print(text)
        } else {
            print(res)
        }
    }

    private static func formatTabs(res: [String: Any]) -> [String] {
        guard let tabs = res["tabs"] as? [[String: Any]], !tabs.isEmpty else { return [] }
        var lines: [String] = []
        lines.reserveCapacity(tabs.count * 2)
        for tab in tabs {
            let id = (tab["targetId"] as? String) ?? ""
            let title = (tab["title"] as? String) ?? ""
            let url = (tab["url"] as? String) ?? ""
            let shortId = id.isEmpty ? "" : String(id.prefix(8))
            lines.append("- \(shortId)  \(title)  \(url)")
            if !id.isEmpty {
                lines.append("  id: \(id)")
            }
        }
        return lines
    }

    private static func printTabs(res: [String: Any]) {
        let running = (res["running"] as? Bool) ?? false
        print("Running: \(running)")
        for line in self.formatTabs(res: res) {
            print(line)
        }
    }

    private static func printEval(res: [String: Any]) {
        guard let obj = res["result"] as? [String: Any] else {
            self.printResult(jsonOutput: false, res: res)
            return
        }

        if let value = obj["value"] {
            if JSONSerialization.isValidJSONObject(value),
               let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted]),
               let text = String(data: data, encoding: .utf8)
            {
                print(text)
            } else {
                print(String(describing: value))
            }
            return
        }

        if let desc = obj["description"] as? String, !desc.isEmpty {
            print(desc)
            return
        }

        self.printResult(jsonOutput: false, res: obj)
    }

    private static func printQuery(res: [String: Any]) {
        guard let matches = res["matches"] as? [[String: Any]] else {
            self.printResult(jsonOutput: false, res: res)
            return
        }
        if matches.isEmpty {
            print("No matches.")
            return
        }
        for m in matches {
            let index = (m["index"] as? Int) ?? 0
            let tag = (m["tag"] as? String) ?? ""
            let id = (m["id"] as? String).map { "#\($0)" } ?? ""
            let className = (m["className"] as? String) ?? ""
            let classes = className.split(separator: " ").prefix(3).map(String.init)
            let cls = classes.isEmpty ? "" : "." + classes.joined(separator: ".")
            let head = "\(index). <\(tag)\(id)\(cls)>"
            print(head)
            if let text = m["text"] as? String, !text.isEmpty {
                print("   \(text)")
            }
        }
    }

    private static func printSnapshotAria(res: [String: Any]) {
        guard let nodes = res["nodes"] as? [[String: Any]] else {
            self.printResult(jsonOutput: false, res: res)
            return
        }
        for n in nodes {
            let depth = (n["depth"] as? Int) ?? 0
            let role = (n["role"] as? String) ?? "unknown"
            let name = (n["name"] as? String) ?? ""
            let value = (n["value"] as? String) ?? ""
            let indent = String(repeating: "  ", count: min(depth, 20))
            var line = "\(indent)- \(role)"
            if !name.isEmpty { line += " \"\(name)\"" }
            if !value.isEmpty { line += " = \"\(value)\"" }
            print(line)
        }
    }

    #if SWIFT_PACKAGE
    static func _testFormatTabs(res: [String: Any]) -> [String] {
        self.formatTabs(res: res)
    }
    #endif

    private static func printJSON(ok: Bool, result: Any) {
        let obj: [String: Any] = ["ok": ok, "result": result]
        if let data = try? JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted]),
           let text = String(data: data, encoding: .utf8)
        {
            print(text)
        } else {
            print("{\"ok\":false,\"error\":\"failed to encode json\"}")
        }
    }

    private static func printHelp() {
        let usage = """
        Browser (clawd) — control clawd’s dedicated Chrome/Chromium via the gateway’s loopback server.

        Usage:
          clawdis-mac browser status [--url <http://127.0.0.1:18791>]
          clawdis-mac browser start [--url <...>]
          clawdis-mac browser stop [--url <...>]
          clawdis-mac browser tabs [--url <...>]
          clawdis-mac browser open <url> [--url <...>]
          clawdis-mac browser focus <targetId> [--url <...>]
          clawdis-mac browser close <targetId> [--url <...>]
          clawdis-mac browser screenshot [--target-id <id>] [--full-page] [--url <...>]
          clawdis-mac browser eval [<js>] [--js <js>] [--js-file <path>] [--js-stdin]
            [--target-id <id>] [--await] [--url <...>]
          clawdis-mac browser query <selector> [--limit <n>] [--format <text|json>]
            [--target-id <id>] [--url <...>]
          clawdis-mac browser dom [--format <html|text>] [--selector <css>] [--max-chars <n>]
            [--out <path>] [--target-id <id>] [--url <...>]
          clawdis-mac browser snapshot [--format <aria|domSnapshot>] [--limit <n>] [--out <path>]
            [--target-id <id>] [--url <...>]

        Notes:
          - Config defaults come from ~/.clawdis/clawdis.json (browser.enabled, browser.controlUrl).
          - `browser screenshot` prints MEDIA:<path> in text mode.
        """
        print(usage)
    }
}
