import Darwin
import Foundation
import PeekabooAutomationKit
import PeekabooBridge
import PeekabooFoundation

enum UICLI {
    static func run(args: [String], jsonOutput: Bool) async throws -> Int32 {
        var args = args
        guard let sub = args.first else {
            self.printHelp()
            return 0
        }
        args.removeFirst()

        if sub == "--help" || sub == "-h" || sub == "help" {
            self.printHelp()
            return 0
        }

        let context = try await self.resolveContext()

        switch sub {
        case "permissions":
            return try await self.runPermissions(args: args, jsonOutput: jsonOutput, context: context)
        case "frontmost":
            return try await self.runFrontmost(args: args, jsonOutput: jsonOutput, context: context)
        case "apps":
            return try await self.runApps(args: args, jsonOutput: jsonOutput, context: context)
        case "windows":
            return try await self.runWindows(args: args, jsonOutput: jsonOutput, context: context)
        case "screenshot":
            return try await self.runScreenshot(args: args, jsonOutput: jsonOutput, context: context)
        case "see":
            return try await self.runSee(args: args, jsonOutput: jsonOutput, context: context)
        case "click":
            return try await self.runClick(args: args, jsonOutput: jsonOutput, context: context)
        case "type":
            return try await self.runType(args: args, jsonOutput: jsonOutput, context: context)
        case "wait":
            return try await self.runWait(args: args, jsonOutput: jsonOutput, context: context)
        default:
            self.printHelp()
            return 1
        }
    }

    // MARK: - Context

    private struct Context {
        let client: PeekabooBridgeClient
        let hostDescription: String
    }

    private static func resolveContext() async throws -> Context {
        let explicitSocket = ProcessInfo.processInfo.environment["PEEKABOO_BRIDGE_SOCKET"]
        let candidates: [String] = if let explicitSocket, !explicitSocket.isEmpty {
            [explicitSocket]
        } else {
            [
                PeekabooBridgeConstants.peekabooSocketPath,
                PeekabooBridgeConstants.clawdisSocketPath,
            ]
        }

        let identity = PeekabooBridgeClientIdentity(
            bundleIdentifier: Bundle.main.bundleIdentifier,
            teamIdentifier: nil,
            processIdentifier: getpid(),
            hostname: Host.current().name)

        for socketPath in candidates {
            let client = PeekabooBridgeClient(socketPath: socketPath, requestTimeoutSec: 10)
            do {
                let handshake = try await client.handshake(client: identity, requestedHost: nil)
                return Context(
                    client: client,
                    hostDescription: "\(handshake.hostKind.rawValue) via \(socketPath)")
            } catch let envelope as PeekabooBridgeErrorEnvelope {
                if envelope.code == .unauthorizedClient {
                    throw envelope
                }
            } catch {
                continue
            }
        }

        throw NSError(domain: "clawdis.ui", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "No PeekabooBridge host reachable (run Peekaboo.app or Clawdis.app).",
        ])
    }

    // MARK: - Commands

    private static func runPermissions(args: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        let sub = args.first ?? "status"
        if sub != "status", sub != "--help", sub != "-h", sub != "help" {
            self.printHelp()
            return 1
        }
        let status = try await context.client.permissionsStatus()
        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
                "result": self.toJSONObject(status),
            ])
        } else {
            FileHandle.standardOutput.write(Data((self.formatPermissions(status) + "\n").utf8))
        }
        return 0
    }

    private static func runFrontmost(args _: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        let app = try await context.client.getFrontmostApplication()
        let window = try await context.client.getFocusedWindow()
        if jsonOutput {
            let windowObject: Any = if let window {
                try self.toJSONObject(window)
            } else {
                NSNull()
            }
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
                "app": self.toJSONObject(app),
                "window": windowObject,
            ])
        } else {
            let bundle = app.bundleIdentifier ?? "<unknown>"
            let line = "\(bundle) (pid \(app.processIdentifier))"
            FileHandle.standardOutput.write(Data((line + "\n").utf8))
            if let window {
                FileHandle.standardOutput.write(Data("window \(window.windowID): \(window.title)\n".utf8))
            }
        }
        return 0
    }

    private static func runApps(args _: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        let apps = try await context.client.listApplications()
        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
                "result": self.toJSONObject(apps),
            ])
        } else {
            for app in apps {
                let bundle = app.bundleIdentifier ?? "<unknown>"
                FileHandle.standardOutput.write(Data("\(bundle)\t\(app.name)\n".utf8))
            }
        }
        return 0
    }

    private static func runWindows(args: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        var args = args
        var bundleId: String?
        while !args.isEmpty {
            switch args.removeFirst() {
            case "--bundle-id":
                bundleId = args.popFirst()
            case "--help", "-h", "help":
                self.printHelp()
                return 0
            default:
                break
            }
        }

        let target: WindowTarget = if let bundleId, !bundleId.isEmpty { .application(bundleId) } else { .frontmost }
        let windows = try await context.client.listWindows(target: target)

        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
                "result": self.toJSONObject(windows),
            ])
        } else {
            for window in windows {
                FileHandle.standardOutput.write(Data("\(window.windowID)\t\(window.title)\n".utf8))
            }
        }
        return 0
    }

    private static func runScreenshot(args: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        var args = args
        var displayIndex: Int?
        var bundleId: String?
        var windowIndex: Int?
        var mode: CaptureVisualizerMode = .screenshotFlash
        var scale: CaptureScalePreference = .logical1x

        while !args.isEmpty {
            let arg = args.removeFirst()
            switch arg {
            case "--screen-index":
                displayIndex = args.popFirst().flatMap(Int.init)
            case "--bundle-id":
                bundleId = args.popFirst()
            case "--window-index":
                windowIndex = args.popFirst().flatMap(Int.init)
            case "--watch":
                mode = .watchCapture
            case "--scale":
                let raw = args.popFirst()?.lowercased()
                if raw == "native" { scale = .native }
                if raw == "1x" || raw == "logical" || raw == "logical1x" { scale = .logical1x }
            case "--help", "-h", "help":
                self.printHelp()
                return 0
            default:
                break
            }
        }

        let capture: CaptureResult = if let bundleId, !bundleId.isEmpty {
            try await context.client.captureWindow(
                appIdentifier: bundleId,
                windowIndex: windowIndex,
                visualizerMode: mode,
                scale: scale)
        } else if displayIndex != nil {
            try await context.client.captureScreen(
                displayIndex: displayIndex,
                visualizerMode: mode,
                scale: scale)
        } else {
            try await context.client.captureFrontmost(visualizerMode: mode, scale: scale)
        }

        let path = try self.writeTempPNG(capture.imageData)

        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
                "path": path,
                "metadata": self.toJSONObject(capture.metadata),
                "warning": capture.warning ?? "",
            ])
        } else {
            FileHandle.standardOutput.write(Data((path + "\n").utf8))
        }
        return 0
    }

    private static func runSee(args: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        var args = args
        var bundleId: String?
        var windowIndex: Int?
        var snapshotId: String?

        while !args.isEmpty {
            let arg = args.removeFirst()
            switch arg {
            case "--bundle-id":
                bundleId = args.popFirst()
            case "--window-index":
                windowIndex = args.popFirst().flatMap(Int.init)
            case "--snapshot-id":
                snapshotId = args.popFirst()
            case "--help", "-h", "help":
                self.printHelp()
                return 0
            default:
                break
            }
        }

        let capture: CaptureResult
        if let bundleId, !bundleId.isEmpty {
            capture = try await context.client.captureWindow(
                appIdentifier: bundleId,
                windowIndex: windowIndex,
                visualizerMode: .screenshotFlash,
                scale: .logical1x)
        } else {
            capture = try await context.client.captureFrontmost(visualizerMode: .screenshotFlash, scale: .logical1x)
            bundleId = capture.metadata.applicationInfo?.bundleIdentifier
        }

        let resolvedSnapshotId: String = if let snapshotId, !snapshotId.isEmpty {
            snapshotId
        } else if let bundleId, !bundleId.isEmpty, let existing = try? await context.client
            .getMostRecentSnapshot(applicationBundleId: bundleId)
        {
            existing
        } else {
            try await context.client.createSnapshot()
        }

        let screenshotPath = try self.writeTempPNG(capture.imageData)

        try await context.client.storeScreenshot(
            snapshotId: resolvedSnapshotId,
            screenshotPath: screenshotPath,
            applicationBundleId: bundleId,
            applicationProcessId: capture.metadata.applicationInfo?.processIdentifier,
            applicationName: capture.metadata.applicationInfo?.name,
            windowTitle: capture.metadata.windowInfo?.title,
            windowBounds: capture.metadata.windowInfo?.bounds)

        let windowContext = WindowContext(
            applicationName: capture.metadata.applicationInfo?.name,
            windowTitle: capture.metadata.windowInfo?.title,
            windowBounds: capture.metadata.windowInfo?.bounds)

        let detection = try await context.client.detectElements(
            in: capture.imageData,
            snapshotId: resolvedSnapshotId,
            windowContext: windowContext)
        try await context.client.storeDetectionResult(snapshotId: resolvedSnapshotId, result: detection)

        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
                "snapshotId": resolvedSnapshotId,
                "screenshotPath": screenshotPath,
                "result": self.toJSONObject(detection),
            ])
        } else {
            FileHandle.standardOutput.write(Data((screenshotPath + "\n").utf8))
            for el in detection.elements.all {
                let b = el.bounds
                let label = (el.label ?? el.value ?? "").replacingOccurrences(of: "\n", with: " ")
                let line =
                    "\(el.id)\t\(el.type)\t\(Int(b.origin.x)),\(Int(b.origin.y)) \(Int(b.size.width))x\(Int(b.size.height))\t\(label)\n"
                FileHandle.standardOutput.write(Data(line.utf8))
            }
        }
        return 0
    }

    private static func runClick(args: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        var args = args
        var bundleId: String?
        var snapshotId: String?
        var on: String?
        var clickType: ClickType = .single

        while !args.isEmpty {
            let arg = args.removeFirst()
            switch arg {
            case "--bundle-id":
                bundleId = args.popFirst()
            case "--snapshot-id":
                snapshotId = args.popFirst()
            case "--on":
                on = args.popFirst()
            case "--double":
                clickType = .double
            case "--right":
                clickType = .right
            case "--help", "-h", "help":
                self.printHelp()
                return 0
            default:
                break
            }
        }

        guard let on, !on.isEmpty else {
            throw NSError(domain: "clawdis.ui", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Missing --on <elementId> (run `clawdis-mac ui see` first).",
            ])
        }

        let effectiveSnapshotId = try await self.resolveImplicitSnapshotId(
            snapshotId: snapshotId,
            bundleId: bundleId,
            client: context.client)

        try await context.client.click(target: .elementId(on), clickType: clickType, snapshotId: effectiveSnapshotId)

        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
            ])
        }
        return 0
    }

    private static func runType(args: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        var args = args
        var bundleId: String?
        var snapshotId: String?
        var into: String?
        var clearExisting = false
        var delayMs = 20
        var textParts: [String] = []

        while !args.isEmpty {
            let arg = args.removeFirst()
            switch arg {
            case "--bundle-id":
                bundleId = args.popFirst()
            case "--snapshot-id":
                snapshotId = args.popFirst()
            case "--into":
                into = args.popFirst()
            case "--clear":
                clearExisting = true
            case "--delay-ms":
                delayMs = args.popFirst().flatMap(Int.init) ?? delayMs
            case "--text":
                if let next = args.popFirst() {
                    textParts.append(next)
                }
            case "--help", "-h", "help":
                self.printHelp()
                return 0
            default:
                textParts.append(arg)
            }
        }

        let text = textParts.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            throw NSError(domain: "clawdis.ui", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "Missing text (use --text <value>).",
            ])
        }

        let effectiveSnapshotId = try await self.resolveImplicitSnapshotId(
            snapshotId: snapshotId,
            bundleId: bundleId,
            client: context.client)

        try await context.client.type(
            text: text,
            target: into,
            clearExisting: clearExisting,
            typingDelay: delayMs,
            snapshotId: effectiveSnapshotId)

        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
            ])
        }
        return 0
    }

    private static func runWait(args: [String], jsonOutput: Bool, context: Context) async throws -> Int32 {
        var args = args
        var bundleId: String?
        var snapshotId: String?
        var on: String?
        var timeoutSec: Double = 10

        while !args.isEmpty {
            let arg = args.removeFirst()
            switch arg {
            case "--bundle-id":
                bundleId = args.popFirst()
            case "--snapshot-id":
                snapshotId = args.popFirst()
            case "--on":
                on = args.popFirst()
            case "--timeout":
                timeoutSec = args.popFirst().flatMap(Double.init) ?? timeoutSec
            case "--help", "-h", "help":
                self.printHelp()
                return 0
            default:
                break
            }
        }

        guard let on, !on.isEmpty else {
            throw NSError(domain: "clawdis.ui", code: 4, userInfo: [
                NSLocalizedDescriptionKey: "Missing --on <elementId>.",
            ])
        }

        let effectiveSnapshotId = try await self.resolveImplicitSnapshotId(
            snapshotId: snapshotId,
            bundleId: bundleId,
            client: context.client)

        let result = try await context.client.waitForElement(
            target: .elementId(on),
            timeout: timeoutSec,
            snapshotId: effectiveSnapshotId)

        if jsonOutput {
            try self.writeJSON([
                "ok": true,
                "host": context.hostDescription,
                "result": self.toJSONObject(result),
            ])
        } else {
            FileHandle.standardOutput.write(Data((result.found ? "found\n" : "not found\n").utf8))
        }
        return result.found ? 0 : 1
    }

    private static func resolveImplicitSnapshotId(
        snapshotId: String?,
        bundleId: String?,
        client: PeekabooBridgeClient) async throws -> String
    {
        if let snapshotId, !snapshotId.isEmpty { return snapshotId }

        let resolvedBundle: String? = if let bundleId, !bundleId.isEmpty {
            bundleId
        } else {
            try await client.getFrontmostApplication().bundleIdentifier
        }

        guard let resolvedBundle, !resolvedBundle.isEmpty else {
            throw NSError(domain: "clawdis.ui", code: 5, userInfo: [
                NSLocalizedDescriptionKey: "Could not determine bundle id for implicit snapshot.",
            ])
        }

        do {
            return try await client.getMostRecentSnapshot(applicationBundleId: resolvedBundle)
        } catch {
            throw NSError(domain: "clawdis.ui", code: 6, userInfo: [
                NSLocalizedDescriptionKey: "No recent snapshot for \(resolvedBundle). Run `clawdis-mac ui see --bundle-id \(resolvedBundle)` first.",
            ])
        }
    }

    // MARK: - IO helpers

    private static func writeTempPNG(_ data: Data) throws -> String {
        let dir = FileManager.default.temporaryDirectory
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let stamp = formatter.string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let url = dir.appendingPathComponent("clawdis-ui-\(stamp).png")
        try data.write(to: url, options: [.atomic])
        return url.path
    }

    private static func formatPermissions(_ status: PermissionsStatus) -> String {
        let sr = status.screenRecording ? "screen-recording=ok" : "screen-recording=missing"
        let ax = status.accessibility ? "accessibility=ok" : "accessibility=missing"
        let ascr = status.appleScript ? "applescript=ok" : "applescript=missing"
        return "\(sr) \(ax) \(ascr)"
    }

    private static func toJSONObject(_ value: some Encodable) throws -> Any {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(value)
        return try JSONSerialization.jsonObject(with: data)
    }

    private static func writeJSON(_ obj: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted])
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data([0x0A]))
    }

    private static func printHelp() {
        let usage = """
        clawdis-mac ui — UI automation via PeekabooBridge

        Usage:
          clawdis-mac [--json] ui <command> ...

        Commands:
          permissions status
          frontmost
          apps
          windows [--bundle-id <id>]
          screenshot [--screen-index <n>] [--bundle-id <id>] [--window-index <n>] [--watch] [--scale native|1x]
          see [--bundle-id <id>] [--window-index <n>] [--snapshot-id <id>]
          click --on <elementId> [--bundle-id <id>] [--snapshot-id <id>] [--double|--right]
          type --text <value> [--into <elementId>] [--bundle-id <id>] [--snapshot-id <id>] [--clear] [--delay-ms <n>]
          wait --on <elementId> [--bundle-id <id>] [--snapshot-id <id>] [--timeout <sec>]

        Notes:
          - Prefers Peekaboo.app’s bridge, then Clawdis.app’s bridge.
          - Default timeout is 10 seconds per action.
        """
        FileHandle.standardError.write(Data((usage + "\n").utf8))
    }
}
