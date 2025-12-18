import Testing
import WebKit
@testable import Clawdis

@Suite struct ScreenControllerTests {
    @Test @MainActor func canvasModeConfiguresWebViewForTouch() {
        let screen = ScreenController()

        #expect(screen.mode == .canvas)
        #expect(screen.webView.isOpaque == true)
        #expect(screen.webView.backgroundColor == .black)

        let scrollView = screen.webView.scrollView
        #expect(scrollView.backgroundColor == .black)
        #expect(scrollView.contentInsetAdjustmentBehavior == .never)
        #expect(scrollView.isScrollEnabled == false)
        #expect(scrollView.bounces == false)
    }

    @Test @MainActor func navigateDefaultsToWebMode() {
        let screen = ScreenController()
        screen.navigate(to: "not a url")

        #expect(screen.mode == .web)
    }

    @Test @MainActor func evalExecutesJavaScript() async throws {
        let screen = ScreenController()
        let deadline = ContinuousClock().now.advanced(by: .seconds(3))

        while true {
            do {
                let result = try await screen.eval(javaScript: "1+1")
                #expect(result == "2")
                return
            } catch {
                if ContinuousClock().now >= deadline {
                    throw error
                }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
        }
    }
}
