import AppKit
import Foundation
import ServiceManagement
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var isPaused: Bool {
        didSet { UserDefaults.standard.set(self.isPaused, forKey: pauseDefaultsKey) }
    }

    @Published var defaultSound: String {
        didSet { UserDefaults.standard.set(self.defaultSound, forKey: "clawdis.defaultSound") }
    }

    @Published var launchAtLogin: Bool {
        didSet { Task { AppStateStore.updateLaunchAtLogin(enabled: self.launchAtLogin) } }
    }

    @Published var onboardingSeen: Bool {
        didSet { UserDefaults.standard.set(self.onboardingSeen, forKey: "clawdis.onboardingSeen") }
    }

    @Published var debugPaneEnabled: Bool {
        didSet { UserDefaults.standard.set(self.debugPaneEnabled, forKey: "clawdis.debugPaneEnabled") }
    }

    @Published var swabbleEnabled: Bool {
        didSet { UserDefaults.standard.set(self.swabbleEnabled, forKey: swabbleEnabledKey) }
    }

    @Published var swabbleTriggerWords: [String] {
        didSet {
            let cleaned = self.swabbleTriggerWords.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            UserDefaults.standard.set(cleaned, forKey: swabbleTriggersKey)
            if cleaned.count != self.swabbleTriggerWords.count {
                self.swabbleTriggerWords = cleaned
            }
        }
    }

    @Published var showDockIcon: Bool {
        didSet {
            UserDefaults.standard.set(self.showDockIcon, forKey: showDockIconKey)
            AppActivationPolicy.apply(showDockIcon: self.showDockIcon)
        }
    }

    @Published var voiceWakeMicID: String {
        didSet { UserDefaults.standard.set(self.voiceWakeMicID, forKey: voiceWakeMicKey) }
    }

    @Published var voiceWakeLocaleID: String {
        didSet { UserDefaults.standard.set(self.voiceWakeLocaleID, forKey: voiceWakeLocaleKey) }
    }

    @Published var voiceWakeAdditionalLocaleIDs: [String] {
        didSet { UserDefaults.standard.set(self.voiceWakeAdditionalLocaleIDs, forKey: voiceWakeAdditionalLocalesKey) }
    }

    @Published var isWorking: Bool = false
    @Published var earBoostActive: Bool = false

    private var earBoostTask: Task<Void, Never>?

    init() {
        self.isPaused = UserDefaults.standard.bool(forKey: pauseDefaultsKey)
        self.defaultSound = UserDefaults.standard.string(forKey: "clawdis.defaultSound") ?? ""
        self.launchAtLogin = SMAppService.mainApp.status == .enabled
        self.onboardingSeen = UserDefaults.standard.bool(forKey: "clawdis.onboardingSeen")
        self.debugPaneEnabled = UserDefaults.standard.bool(forKey: "clawdis.debugPaneEnabled")
        let savedVoiceWake = UserDefaults.standard.bool(forKey: swabbleEnabledKey)
        self.swabbleEnabled = voiceWakeSupported ? savedVoiceWake : false
        self.swabbleTriggerWords = UserDefaults.standard
            .stringArray(forKey: swabbleTriggersKey) ?? defaultVoiceWakeTriggers
        self.showDockIcon = UserDefaults.standard.bool(forKey: showDockIconKey)
        self.voiceWakeMicID = UserDefaults.standard.string(forKey: voiceWakeMicKey) ?? ""
        self.voiceWakeLocaleID = UserDefaults.standard.string(forKey: voiceWakeLocaleKey) ?? Locale.current.identifier
        self.voiceWakeAdditionalLocaleIDs = UserDefaults.standard
            .stringArray(forKey: voiceWakeAdditionalLocalesKey) ?? []
    }

    func triggerVoiceEars(ttl: TimeInterval = 5) {
        self.earBoostTask?.cancel()
        self.earBoostActive = true
        self.earBoostTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(ttl * 1_000_000_000))
            await MainActor.run { [weak self] in self?.earBoostActive = false }
        }
    }

    func setWorking(_ working: Bool) {
        self.isWorking = working
    }
}

@MainActor
enum AppStateStore {
    static let shared = AppState()
    static var isPausedFlag: Bool { UserDefaults.standard.bool(forKey: pauseDefaultsKey) }
    static var defaultSound: String { UserDefaults.standard.string(forKey: "clawdis.defaultSound") ?? "" }

    static func updateLaunchAtLogin(enabled: Bool) {
        if enabled {
            try? SMAppService.mainApp.register()
        } else {
            try? SMAppService.mainApp.unregister()
        }
    }
}

@MainActor
enum AppActivationPolicy {
    static func apply(showDockIcon: Bool) {
        NSApp.setActivationPolicy(showDockIcon ? .regular : .accessory)
    }
}
