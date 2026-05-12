import Foundation

public enum GobboCameraCommand: String, Codable, Sendable {
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum GobboCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum GobboCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum GobboCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct GobboCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: GobboCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: GobboCameraImageFormat?

    public init(
        facing: GobboCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: GobboCameraImageFormat? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
    }
}

public struct GobboCameraClipParams: Codable, Sendable, Equatable {
    public var facing: GobboCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: GobboCameraVideoFormat?

    public init(
        facing: GobboCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: GobboCameraVideoFormat? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
    }
}
