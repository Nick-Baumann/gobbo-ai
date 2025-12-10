import Foundation
import OSLog
#if canImport(Darwin)
import Darwin
#endif

actor PortGuardian {
    static let shared = PortGuardian()

    struct Record: Codable {
        let port: Int
        let pid: Int32
        let command: String
        let mode: String
        let timestamp: TimeInterval
    }

    struct Descriptor: Sendable {
        let pid: Int32
        let command: String
        let executablePath: String?
    }

    private var records: [Record] = []
    private let logger = Logger(subsystem: "com.steipete.clawdis", category: "portguard")
    nonisolated private static let appSupportDir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("Clawdis", isDirectory: true)
    }()
    nonisolated private static var recordPath: URL {
        self.appSupportDir.appendingPathComponent("port-guard.json", isDirectory: false)
    }

    init() {
        self.records = Self.loadRecords(from: Self.recordPath)
    }

    func sweep(mode: AppState.ConnectionMode) async {
        self.logger.info("port sweep starting (mode=\(mode.rawValue, privacy: .public))")
        let ports = [18788, 18789]
        for port in ports {
            let listeners = await self.listeners(on: port)
            guard !listeners.isEmpty else { continue }
            for listener in listeners {
                if self.isExpected(listener, port: port, mode: mode) {
                    self.logger.info("port \(port, privacy: .public) already served by expected \(listener.command, privacy: .public) (pid \(listener.pid)) — keeping")
                    continue
                }
                let killed = await self.kill(listener.pid)
                if killed {
                    self.logger.error("port \(port, privacy: .public) was held by \(listener.command, privacy: .public) (pid \(listener.pid)); terminated")
                } else {
                    self.logger.error("failed to terminate pid \(listener.pid) on port \(port, privacy: .public)")
                }
            }
        }
        self.logger.info("port sweep done")
    }

    func record(port: Int, pid: Int32, command: String, mode: AppState.ConnectionMode) async {
        try? FileManager.default.createDirectory(at: Self.appSupportDir, withIntermediateDirectories: true)
        self.records.removeAll { $0.pid == pid }
        self.records.append(Record(port: port, pid: pid, command: command, mode: mode.rawValue, timestamp: Date().timeIntervalSince1970))
        self.save()
    }

    func removeRecord(pid: Int32) {
        let before = self.records.count
        self.records.removeAll { $0.pid == pid }
        if self.records.count != before {
            self.save()
        }
    }

    struct PortReport: Identifiable {
        enum Status {
            case ok(String)
            case missing(String)
            case interference(String, offenders: [ReportListener])
        }

        let port: Int
        let expected: String
        let status: Status
        let listeners: [ReportListener]

        var id: Int { self.port }

        var offenders: [ReportListener] {
            if case let .interference(_, offenders) = self.status { return offenders }
            return []
        }

        var summary: String {
            switch self.status {
            case let .ok(text): return text
            case let .missing(text): return text
            case let .interference(text, _): return text
            }
        }
    }

    func describe(port: Int) async -> Descriptor? {
        guard let listener = await self.listeners(on: port).first else { return nil }
        let path = Self.executablePath(for: listener.pid)
        return Descriptor(pid: listener.pid, command: listener.command, executablePath: path)
    }
    // MARK: - Internals

    private struct Listener {
        let pid: Int32
        let command: String
        let fullCommand: String
        let user: String?
    }

    struct ReportListener: Identifiable {
        let pid: Int32
        let command: String
        let fullCommand: String
        let user: String?
        let expected: Bool

        var id: Int32 { self.pid }
    }

    func diagnose(mode: AppState.ConnectionMode) async -> [PortReport] {
        let ports = [18788, 18789]
        var reports: [PortReport] = []

        for port in ports {
            let listeners = await self.listeners(on: port)
            let expectedDesc: String
            let okPredicate: (Listener) -> Bool

            switch mode {
            case .remote:
                expectedDesc = "SSH tunnel to remote gateway"
                okPredicate = { $0.command.lowercased().contains("ssh") }
            case .local:
                expectedDesc = port == 18788
                    ? "Gateway webchat/static host"
                    : "Gateway websocket (node/tsx)"
                okPredicate = { listener in
                    let c = listener.command.lowercased()
                    return c.contains("node") || c.contains("clawdis") || c.contains("tsx") || c.contains("pnpm") || c.contains("bun")
                }
            }

            if listeners.isEmpty {
                let text = "Nothing is listening on \(port) (\(expectedDesc))."
                reports.append(.init(port: port, expected: expectedDesc, status: .missing(text), listeners: []))
                continue
            }

            let reportListeners = listeners.map { listener in
                ReportListener(
                    pid: listener.pid,
                    command: listener.command,
                    fullCommand: listener.fullCommand,
                    user: listener.user,
                    expected: okPredicate(listener))
            }

            let offenders = reportListeners.filter { !$0.expected }
            if offenders.isEmpty {
                let list = listeners.map { "\($0.command) (\($0.pid))" }.joined(separator: ", ")
                let okText = "Port \(port) is served by \(list)."
                reports.append(.init(port: port, expected: expectedDesc, status: .ok(okText), listeners: reportListeners))
            } else {
                let list = offenders.map { "\($0.command) (\($0.pid))" }.joined(separator: ", ")
                let reason = "Port \(port) is held by \(list), expected \(expectedDesc)."
                reports.append(.init(port: port, expected: expectedDesc, status: .interference(reason, offenders: offenders), listeners: reportListeners))
            }
        }

        return reports
    }

    private func listeners(on port: Int) async -> [Listener] {
        let res = await ShellExecutor.run(
            command: ["lsof", "-nP", "-iTCP:\(port)", "-sTCP:LISTEN", "-Fpcn"],
            cwd: nil,
            env: nil,
            timeout: 5)
        guard res.ok, let data = res.payload, !data.isEmpty else { return [] }
        let text = String(data: data, encoding: .utf8) ?? ""
        var listeners: [Listener] = []
        var currentPid: Int32?
        var currentCmd: String?
        var currentUser: String?

        func flush() {
            if let pid = currentPid, let cmd = currentCmd {
                let full = Self.readFullCommand(pid: pid) ?? cmd
                listeners.append(Listener(pid: pid, command: cmd, fullCommand: full, user: currentUser))
            }
            currentPid = nil
            currentCmd = nil
            currentUser = nil
        }

        for line in text.split(separator: "\n") {
            guard let prefix = line.first else { continue }
            let value = String(line.dropFirst())
            switch prefix {
            case "p":
                flush()
                currentPid = Int32(value) ?? 0
            case "c":
                currentCmd = value
            case "u":
                currentUser = value
            default:
                continue
            }
        }
        flush()
        return listeners
    }

    private static func readFullCommand(pid: Int32) -> String? {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/ps")
        proc.arguments = ["-p", "\(pid)", "-o", "command="]
        let pipe = Pipe()
        proc.standardOutput = pipe
        proc.standardError = Pipe()
        do {
            try proc.run()
            proc.waitUntilExit()
        } catch {
            return nil
        }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard !data.isEmpty else { return nil }
        return String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func executablePath(for pid: Int32) -> String? {
        #if canImport(Darwin)
        var buffer = [CChar](repeating: 0, count: Int(PATH_MAX))
        let length = proc_pidpath(pid, &buffer, UInt32(buffer.count))
        guard length > 0 else { return nil }
        // Drop trailing null and decode as UTF-8.
        let trimmed = buffer.prefix { $0 != 0 }
        return String(decoding: trimmed.map { UInt8(bitPattern: $0) }, as: UTF8.self)
        #else
        return nil
        #endif
    }
    private func kill(_ pid: Int32) async -> Bool {
        let term = await ShellExecutor.run(command: ["kill", "-TERM", "\(pid)"], cwd: nil, env: nil, timeout: 2)
        if term.ok { return true }
        let sigkill = await ShellExecutor.run(command: ["kill", "-KILL", "\(pid)"], cwd: nil, env: nil, timeout: 2)
        return sigkill.ok
    }

    private func isExpected(_ listener: Listener, port: Int, mode: AppState.ConnectionMode) -> Bool {
        let cmd = listener.command.lowercased()
        switch mode {
        case .remote:
            if port == 18788 {
                return cmd.contains("ssh") && cmd.contains("18788")
            }
            return false
        case .local:
            return cmd.contains("node") || cmd.contains("clawdis") || cmd.contains("tsx") || cmd.contains("pnpm") || cmd.contains("bun")
        }
    }

    private static func loadRecords(from url: URL) -> [Record] {
        guard let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([Record].self, from: data)
        else { return [] }
        return decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(self.records) else { return }
        try? data.write(to: Self.recordPath, options: [.atomic])
    }
}
