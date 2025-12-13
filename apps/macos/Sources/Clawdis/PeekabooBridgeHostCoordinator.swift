import Foundation
import os
import PeekabooAutomationKit
import PeekabooBridge
import PeekabooFoundation
import PeekabooVisualizer

@MainActor
final class PeekabooBridgeHostCoordinator {
    static let shared = PeekabooBridgeHostCoordinator()

    private let logger = Logger(subsystem: "com.steipete.clawdis", category: "PeekabooBridge")

    private var host: PeekabooBridgeHost?
    private var services: ClawdisPeekabooBridgeServices?

    func setEnabled(_ enabled: Bool) async {
        if enabled {
            await self.startIfNeeded()
        } else {
            await self.stop()
        }
    }

    func stop() async {
        guard let host else { return }
        await host.stop()
        self.host = nil
        self.services = nil
        self.logger.info("PeekabooBridge host stopped")
    }

    private func startIfNeeded() async {
        guard self.host == nil else { return }

        let allowlistedTeamIDs: Set<String> = ["Y5PE65HELJ"]
        let allowlistedBundles: Set<String> = []

        let services = ClawdisPeekabooBridgeServices()
        let server = PeekabooBridgeServer(
            services: services,
            hostKind: .gui,
            allowlistedTeams: allowlistedTeamIDs,
            allowlistedBundles: allowlistedBundles)

        let host = PeekabooBridgeHost(
            socketPath: PeekabooBridgeConstants.clawdisSocketPath,
            server: server,
            allowedTeamIDs: allowlistedTeamIDs,
            requestTimeoutSec: 10)

        self.services = services
        self.host = host

        await host.start()
        self.logger
            .info("PeekabooBridge host started at \(PeekabooBridgeConstants.clawdisSocketPath, privacy: .public)")
    }
}

@MainActor
private final class ClawdisPeekabooBridgeServices: PeekabooBridgeServiceProviding {
    let permissions: PermissionsService
    let screenCapture: any ScreenCaptureServiceProtocol
    let automation: any UIAutomationServiceProtocol
    let windows: any WindowManagementServiceProtocol
    let applications: any ApplicationServiceProtocol
    let menu: any MenuServiceProtocol
    let dock: any DockServiceProtocol
    let dialogs: any DialogServiceProtocol
    let snapshots: any SnapshotManagerProtocol

    init() {
        let logging = LoggingService(subsystem: "com.steipete.clawdis.peekaboo")
        let visualizer = PeekabooVisualizerFeedbackClient(client: .shared)

        let snapshots = InMemorySnapshotManager(options: .init(
            snapshotValidityWindow: 600,
            maxSnapshots: 50,
            deleteArtifactsOnCleanup: false))
        let applications = ApplicationService(feedbackClient: visualizer)

        let captureBase = ScreenCaptureService(loggingService: logging)
        let screenCapture = FeedbackScreenCaptureService(base: captureBase, feedbackClient: visualizer)

        self.permissions = PermissionsService()
        self.snapshots = snapshots
        self.applications = applications
        self.screenCapture = screenCapture
        self.automation = UIAutomationService(
            snapshotManager: snapshots,
            loggingService: logging,
            searchPolicy: .balanced,
            feedbackClient: visualizer)
        self.windows = WindowManagementService(applicationService: applications, feedbackClient: visualizer)
        self.menu = MenuService(applicationService: applications, feedbackClient: visualizer)
        self.dock = DockService(feedbackClient: visualizer)
        self.dialogs = DialogService(feedbackClient: visualizer)
    }
}

@MainActor
private final class PeekabooVisualizerFeedbackClient: AutomationFeedbackClient {
    private let client: VisualizationClient

    init(client: VisualizationClient) {
        self.client = client
    }

    func connect() {
        self.client.connect()
    }

    func showClickFeedback(at point: CGPoint, type: ClickType) async -> Bool {
        await self.client.showClickFeedback(at: point, type: type)
    }

    func showTypingFeedback(keys: [String], duration: TimeInterval, cadence: TypingCadence) async -> Bool {
        await self.client.showTypingFeedback(keys: keys, duration: duration, cadence: cadence)
    }

    func showScrollFeedback(at point: CGPoint, direction: ScrollDirection, amount: Int) async -> Bool {
        await self.client.showScrollFeedback(at: point, direction: direction, amount: amount)
    }

    func showHotkeyDisplay(keys: [String], duration: TimeInterval) async -> Bool {
        await self.client.showHotkeyDisplay(keys: keys, duration: duration)
    }

    func showSwipeGesture(from: CGPoint, to: CGPoint, duration: TimeInterval) async -> Bool {
        await self.client.showSwipeGesture(from: from, to: to, duration: duration)
    }

    func showMouseMovement(from: CGPoint, to: CGPoint, duration: TimeInterval) async -> Bool {
        await self.client.showMouseMovement(from: from, to: to, duration: duration)
    }

    func showWindowOperation(_ kind: WindowOperationKind, windowRect: CGRect, duration: TimeInterval) async -> Bool {
        let mapped: WindowOperation = switch kind {
        case .close: .close
        case .minimize: .minimize
        case .maximize: .maximize
        case .move: .move
        case .resize: .resize
        case .setBounds: .setBounds
        case .focus: .focus
        }
        return await self.client.showWindowOperation(mapped, windowRect: windowRect, duration: duration)
    }

    func showDialogInteraction(
        element: DialogElementType,
        elementRect: CGRect,
        action: DialogActionType) async -> Bool
    {
        await self.client.showDialogInteraction(element: element, elementRect: elementRect, action: action)
    }

    func showMenuNavigation(menuPath: [String]) async -> Bool {
        await self.client.showMenuNavigation(menuPath: menuPath)
    }

    func showSpaceSwitch(from: Int, to: Int, direction: SpaceSwitchDirection) async -> Bool {
        let mapped: SpaceDirection = direction == .left ? .left : .right
        return await self.client.showSpaceSwitch(from: from, to: to, direction: mapped)
    }

    func showAppLaunch(appName: String, iconPath: String?) async -> Bool {
        await self.client.showAppLaunch(appName: appName, iconPath: iconPath)
    }

    func showAppQuit(appName: String, iconPath: String?) async -> Bool {
        await self.client.showAppQuit(appName: appName, iconPath: iconPath)
    }

    func showScreenshotFlash(in rect: CGRect) async -> Bool {
        await self.client.showScreenshotFlash(in: rect)
    }

    func showWatchCapture(in rect: CGRect) async -> Bool {
        await self.client.showWatchCapture(in: rect)
    }
}

@MainActor
private final class FeedbackScreenCaptureService: ScreenCaptureServiceProtocol {
    private let base: any ScreenCaptureServiceProtocol
    private let feedbackClient: any AutomationFeedbackClient

    init(base: any ScreenCaptureServiceProtocol, feedbackClient: any AutomationFeedbackClient) {
        self.base = base
        self.feedbackClient = feedbackClient
    }

    func captureScreen(
        displayIndex: Int?,
        visualizerMode: CaptureVisualizerMode,
        scale: CaptureScalePreference) async throws -> CaptureResult
    {
        let result = try await self.base.captureScreen(
            displayIndex: displayIndex,
            visualizerMode: visualizerMode,
            scale: scale)
        await self.showCaptureFeedback(mode: visualizerMode, rect: result.metadata.displayInfo?.bounds)
        return result
    }

    func captureWindow(
        appIdentifier: String,
        windowIndex: Int?,
        visualizerMode: CaptureVisualizerMode,
        scale: CaptureScalePreference) async throws -> CaptureResult
    {
        let result = try await self.base.captureWindow(
            appIdentifier: appIdentifier,
            windowIndex: windowIndex,
            visualizerMode: visualizerMode,
            scale: scale)
        await self.showCaptureFeedback(mode: visualizerMode, rect: result.metadata.windowInfo?.bounds)
        return result
    }

    func captureFrontmost(
        visualizerMode: CaptureVisualizerMode,
        scale: CaptureScalePreference) async throws -> CaptureResult
    {
        let result = try await self.base.captureFrontmost(visualizerMode: visualizerMode, scale: scale)
        await self.showCaptureFeedback(mode: visualizerMode, rect: result.metadata.windowInfo?.bounds)
        return result
    }

    func captureArea(
        _ rect: CGRect,
        visualizerMode: CaptureVisualizerMode,
        scale: CaptureScalePreference) async throws -> CaptureResult
    {
        let result = try await self.base.captureArea(rect, visualizerMode: visualizerMode, scale: scale)
        await self.showCaptureFeedback(mode: visualizerMode, rect: rect)
        return result
    }

    func hasScreenRecordingPermission() async -> Bool {
        await self.base.hasScreenRecordingPermission()
    }

    private func showCaptureFeedback(mode: CaptureVisualizerMode, rect: CGRect?) async {
        guard let rect else { return }
        switch mode {
        case .screenshotFlash:
            _ = await self.feedbackClient.showScreenshotFlash(in: rect)
        case .watchCapture:
            _ = await self.feedbackClient.showWatchCapture(in: rect)
        }
    }
}
