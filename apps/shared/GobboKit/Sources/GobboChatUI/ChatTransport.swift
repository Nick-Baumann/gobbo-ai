import Foundation

public enum GobboChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(GobboChatEventPayload)
    case agent(GobboAgentEventPayload)
    case seqGap
}

public protocol GobboChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> GobboChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [GobboChatAttachmentPayload]) async throws -> GobboChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> GobboChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<GobboChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension GobboChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "GobboChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> GobboChatSessionsListResponse {
        throw NSError(
            domain: "GobboChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
