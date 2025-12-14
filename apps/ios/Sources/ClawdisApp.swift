import SwiftUI

@main
struct ClawdisApp: App {
    @StateObject private var appModel: NodeAppModel
    @StateObject private var bridgeController: BridgeConnectionController
    @Environment(\.scenePhase) private var scenePhase

    init() {
        BridgeSettingsStore.bootstrapPersistence()
        let appModel = NodeAppModel()
        _appModel = StateObject(wrappedValue: appModel)
        _bridgeController = StateObject(wrappedValue: BridgeConnectionController(appModel: appModel))
    }

    var body: some Scene {
        WindowGroup {
            RootCanvas()
                .environmentObject(self.appModel)
                .environmentObject(self.appModel.voiceWake)
                .environmentObject(self.bridgeController)
                .onOpenURL { url in
                    Task { await self.appModel.handleDeepLink(url: url) }
                }
                .onChange(of: self.scenePhase) { _, newValue in
                    self.appModel.setScenePhase(newValue)
                    self.bridgeController.setScenePhase(newValue)
                }
        }
    }
}
