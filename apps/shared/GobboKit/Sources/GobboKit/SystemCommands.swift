import Foundation

public enum GobboSystemCommand: String, Codable, Sendable {
    case run = "system.run"
    case notify = "system.notify"
}

public enum GobboNotificationPriority: String, Codable, Sendable {
    case passive
    case active
    case timeSensitive
}

public enum GobboNotificationDelivery: String, Codable, Sendable {
    case system
    case overlay
    case auto
}

public struct GobboSystemRunParams: Codable, Sendable, Equatable {
    public var command: [String]
    public var cwd: String?
    public var env: [String: String]?
    public var timeoutMs: Int?
    public var needsScreenRecording: Bool?

    public init(
        command: [String],
        cwd: String? = nil,
        env: [String: String]? = nil,
        timeoutMs: Int? = nil,
        needsScreenRecording: Bool? = nil)
    {
        self.command = command
        self.cwd = cwd
        self.env = env
        self.timeoutMs = timeoutMs
        self.needsScreenRecording = needsScreenRecording
    }
}

public struct GobboSystemNotifyParams: Codable, Sendable, Equatable {
    public var title: String
    public var body: String
    public var sound: String?
    public var priority: GobboNotificationPriority?
    public var delivery: GobboNotificationDelivery?

    public init(
        title: String,
        body: String,
        sound: String? = nil,
        priority: GobboNotificationPriority? = nil,
        delivery: GobboNotificationDelivery? = nil)
    {
        self.title = title
        self.body = body
        self.sound = sound
        self.priority = priority
        self.delivery = delivery
    }
}
