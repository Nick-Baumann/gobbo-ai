import SwiftUI

struct ContextUsageBar: View {
    let usedTokens: Int
    let contextTokens: Int
    var height: CGFloat = 6

    private var clampedFractionUsed: Double {
        guard self.contextTokens > 0 else { return 0 }
        return min(1, max(0, Double(self.usedTokens) / Double(self.contextTokens)))
    }

    private var percentUsed: Int? {
        guard self.contextTokens > 0, self.usedTokens > 0 else { return nil }
        return min(100, Int(round(self.clampedFractionUsed * 100)))
    }

    private var tint: Color {
        guard let pct = self.percentUsed else { return .secondary }
        if pct >= 95 { return Color(nsColor: .systemRed) }
        if pct >= 80 { return Color(nsColor: .systemOrange) }
        if pct >= 60 { return Color(nsColor: .systemYellow) }
        return Color(nsColor: .systemGreen)
    }

    var body: some View {
        // Prefer the native progress indicator in menus; `GeometryReader` can get wonky
        // inside `MenuBarExtra`-backed menus (often receiving zero width).
        ZStack {
            Capsule()
                .fill(Color.secondary.opacity(0.25))
            ProgressView(value: self.clampedFractionUsed, total: 1)
                .progressViewStyle(.linear)
                .tint(self.tint)
                .clipShape(Capsule())
        }
        .frame(height: self.height)
        .accessibilityLabel("Context usage")
        .accessibilityValue(self.accessibilityValue)
    }

    private var accessibilityValue: String {
        if self.contextTokens <= 0 { return "Unknown context window" }
        let pct = Int(round(self.clampedFractionUsed * 100))
        return "\(pct) percent used"
    }
}
