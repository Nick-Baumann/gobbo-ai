// swift-tools-version: 6.2
// Package manifest for the Gobbo macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "Gobbo",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "GobboIPC", targets: ["GobboIPC"]),
        .executable(name: "Gobbo", targets: ["Gobbo"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(path: "../shared/GobboKit"),
        .package(path: "../../Swabble"),
        .package(path: "../../Peekaboo/Core/PeekabooCore"),
        .package(path: "../../Peekaboo/Core/PeekabooAutomationKit"),
    ],
    targets: [
        .target(
            name: "GobboProtocol",
            dependencies: [],
            path: "Sources/GobboProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "GobboIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Gobbo",
            dependencies: [
                "GobboIPC",
                "GobboProtocol",
                .product(name: "GobboKit", package: "GobboKit"),
                .product(name: "GobboChatUI", package: "GobboKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "PeekabooCore"),
                .product(name: "PeekabooAutomationKit", package: "PeekabooAutomationKit"),
            ],
            resources: [
                .copy("Resources/Gobbo.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "GobboIPCTests",
            dependencies: [
                "GobboIPC",
                "Gobbo",
                "GobboProtocol",
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
