import SwiftUI

struct RootTabs: View {
    @EnvironmentObject private var appModel: NodeAppModel

    var body: some View {
        TabView {
            ScreenTab()
                .tabItem { Label("Screen", systemImage: "rectangle.and.hand.point.up.left") }

            VoiceTab()
                .tabItem { Label("Voice", systemImage: "mic") }

            SettingsTab()
                .tabItem {
                    VStack {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "gearshape")
                            Circle()
                                .fill(self.settingsIndicatorColor)
                                .frame(width: 9, height: 9)
                                .overlay(
                                    Circle()
                                        .stroke(.black.opacity(0.2), lineWidth: 0.5))
                                .shadow(
                                    color: self.settingsIndicatorGlowColor,
                                    radius: self.settingsIndicatorGlowRadius,
                                    x: 0,
                                    y: 0)
                                .offset(x: 7, y: -2)
                        }
                        Text("Settings")
                    }
                }
        }
    }

    private enum BridgeIndicatorState {
        case connected
        case connecting
        case disconnected
    }

    private var bridgeIndicatorState: BridgeIndicatorState {
        if self.appModel.bridgeServerName != nil { return .connected }
        if self.appModel.bridgeStatusText.localizedCaseInsensitiveContains("connecting") { return .connecting }
        return .disconnected
    }

    private var settingsIndicatorColor: Color {
        switch self.bridgeIndicatorState {
        case .connected:
            Color.green
        case .connecting:
            Color.yellow
        case .disconnected:
            Color.red
        }
    }

    private var settingsIndicatorGlowColor: Color {
        switch self.bridgeIndicatorState {
        case .connected:
            Color.green.opacity(0.75)
        case .connecting:
            Color.yellow.opacity(0.6)
        case .disconnected:
            Color.clear
        }
    }

    private var settingsIndicatorGlowRadius: CGFloat {
        switch self.bridgeIndicatorState {
        case .connected:
            6
        case .connecting:
            4
        case .disconnected:
            0
        }
    }
}
