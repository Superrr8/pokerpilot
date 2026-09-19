import AVFAudio
import SwiftUI

@main
struct PokerElevateApp: App {
    init() {
        NativeAudioSession.configure()
    }

    var body: some Scene {
        WindowGroup {
            PokerElevateWebView()
                .background(Color(red: 0.043, green: 0.051, blue: 0.063))
                .ignoresSafeArea(.container, edges: .all)
        }
    }
}

private enum NativeAudioSession {
    static func configure() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            // Web Audio remains safely optional, matching the accepted browser behavior.
        }
    }
}
