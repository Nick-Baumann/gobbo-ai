// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "GobboKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v15),
    ],
    products: [
        .library(name: "GobboKit", targets: ["GobboKit"]),
        .library(name: "GobboChatUI", targets: ["GobboChatUI"]),
    ],
    dependencies: [
        .package(path: "../../../../ElevenLabsKit"),
    ],
    targets: [
        .target(
            name: "GobboKit",
            dependencies: [
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "GobboChatUI",
            dependencies: ["GobboKit"],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "GobboKitTests",
            dependencies: ["GobboKit", "GobboChatUI"],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
