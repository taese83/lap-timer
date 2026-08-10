// R-hybrid-2: 로컬 플러그인 등록 — Capacitor 8은 앱 내장 플러그인을 자동 발견하지 않으므로
// 브리지 로드 시점에 명시 등록한다 (Main.storyboard의 루트 VC가 이 클래스).
import Capacitor
import UIKit

class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        print("⚡️ AppViewController.capacitorDidLoad — HighFpsCamera 등록 시도 (bridge=\(bridge == nil ? "nil" : "ok"))")
        bridge?.registerPluginInstance(HighFpsCameraPlugin())
        print("⚡️ HighFpsCamera 등록 호출 완료")
    }
}
