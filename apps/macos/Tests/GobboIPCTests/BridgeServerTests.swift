import Testing
@testable import Gobbo

@Suite(.serialized)
struct BridgeServerTests {
    @Test func bridgeServerExercisesPaths() async {
        let server = BridgeServer()
        await server.exerciseForTesting()
    }
}
