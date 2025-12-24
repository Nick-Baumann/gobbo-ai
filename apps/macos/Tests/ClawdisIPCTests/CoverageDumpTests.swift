import Darwin
import Foundation
import Testing

@Suite(.serialized)
struct CoverageDumpTests {
    @Test func periodicallyFlushCoverage() async {
        guard ProcessInfo.processInfo.environment["LLVM_PROFILE_FILE"] != nil else { return }
        let deadline = Date().addingTimeInterval(4)
        while Date() < deadline {
            _ = llvmProfileWriteFile()
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
    }
}

@_silgen_name("__llvm_profile_write_file")
private func llvmProfileWriteFile() -> Int32
