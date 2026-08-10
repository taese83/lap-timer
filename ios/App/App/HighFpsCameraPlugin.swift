// R-hybrid-2: 고프레임 카메라 플러그인 — 웹 getUserMedia(60fps 상한·제어 불가)를 대체한다.
// ① 기기가 지원하는 최고 fps 포맷(최대 240) 선택 ② 학습 구간 후 노출·화이트밸런스 잠금
// (블러·시그니처 드리프트 제거) ③ 프레임을 네이티브에서 64×48로 다운스케일해 luma+rgb만
// WebView로 배치 전송(기존 순수 TS 엔진이 무수정 소비) ④ WebView를 투명화하고 그 아래에
// 네이티브 프리뷰 레이어를 깔아 R7 "카메라 전체 배경" UX를 유지한다.
import AVFoundation
import Capacitor
import UIKit

@objc(HighFpsCameraPlugin)
public class HighFpsCameraPlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureVideoDataOutputSampleBufferDelegate {
    public let identifier = "HighFpsCameraPlugin"
    public let jsName = "HighFpsCamera"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    // 엔진 ROI 계약(camera.ts와 동일) — luma 공식도 웹 경로와 비트 단위로 일치시킨다
    private let roiW = 64
    private let roiH = 48

    private let session = AVCaptureSession()
    private let captureQueue = DispatchQueue(label: "hfcam.capture", qos: .userInteractive)
    private var device: AVCaptureDevice?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var running = false
    private var batch: [[String: Any]] = []
    private var batchSize = 1
    private var lockWorkItem: DispatchWorkItem?

    @objc func start(_ call: CAPPluginCall) {
        let targetFps = call.getInt("fps") ?? 240
        AVCaptureDevice.requestAccess(for: .video) { granted in
            guard granted else {
                call.reject("NotAllowedError: 카메라 권한 거부")
                return
            }
            self.captureQueue.async {
                do {
                    let fps = try self.configureSession(targetFps: targetFps)
                    self.session.startRunning()
                    self.running = true
                    DispatchQueue.main.async {
                        self.attachPreview()
                        // 학습 구간(store LEARN 1.2s) 동안 AE/AWB 수렴 후 잠금 — 통과 순간의
                        // 노출 출렁임·화이트밸런스 드리프트(웹에서 R2·R8 보정 대상)를 원천 제거
                        let work = DispatchWorkItem { self.lockExposureAndWhiteBalance() }
                        self.lockWorkItem = work
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4, execute: work)
                    }
                    call.resolve(["fps": fps])
                } catch {
                    call.reject("카메라 구성 실패: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        lockWorkItem?.cancel()
        captureQueue.async {
            if self.running {
                self.session.stopRunning()
                self.running = false
            }
            self.batch.removeAll()
            DispatchQueue.main.async {
                self.detachPreview()
                call.resolve()
            }
        }
    }

    private enum CamError: Error { case noDevice, noFormat }

    private func configureSession(targetFps: Int) throws -> Int {
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }
        session.sessionPreset = .inputPriority

        guard let dev = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw CamError.noDevice
        }
        device = dev

        // 목표 fps 이상을 지원하는 포맷 중 최소 해상도 선택 — 다운스케일 대상이라 해상도는
        // 낮을수록 좋고, fps가 우선이다. 미지원 기기는 달성 가능한 최고 fps로 자동 하향.
        var best: (format: AVCaptureDevice.Format, fps: Int, width: Int32)?
        for format in dev.formats {
            let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            guard dims.width >= 480 else { continue }
            let maxRate = format.videoSupportedFrameRateRanges.map(\.maxFrameRate).max() ?? 0
            let achievable = min(targetFps, Int(maxRate))
            guard achievable >= 30 else { continue }
            if let cur = best {
                if achievable > cur.fps || (achievable == cur.fps && dims.width < cur.width) {
                    best = (format, achievable, dims.width)
                }
            } else {
                best = (format, achievable, dims.width)
            }
        }
        guard let chosen = best else { throw CamError.noFormat }

        try dev.lockForConfiguration()
        dev.activeFormat = chosen.format
        let duration = CMTime(value: 1, timescale: Int32(chosen.fps))
        dev.activeVideoMinFrameDuration = duration
        dev.activeVideoMaxFrameDuration = duration
        dev.unlockForConfiguration()

        let input = try AVCaptureDeviceInput(device: dev)
        guard session.canAddInput(input) else { throw CamError.noDevice }
        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: captureQueue)
        guard session.canAddOutput(output) else { throw CamError.noFormat }
        session.addOutput(output)

        // 브리지 부하 억제: 초당 ~60 메시지가 되도록 배치 (240fps→4, 120fps→2, 60fps→1)
        batchSize = max(1, chosen.fps / 60)
        return chosen.fps
    }

    private func lockExposureAndWhiteBalance() {
        guard let dev = device else { return }
        do {
            try dev.lockForConfiguration()
            if dev.isExposureModeSupported(.locked) { dev.exposureMode = .locked }
            if dev.isWhiteBalanceModeSupported(.locked) { dev.whiteBalanceMode = .locked }
            dev.unlockForConfiguration()
        } catch {
            // 잠금 실패는 치명적이지 않음 — 자동 모드로 계속 (웹과 동일 조건)
        }
    }

    private func attachPreview() {
        guard let webView = bridge?.webView, let superview = webView.superview else { return }
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = superview.bounds
        if let connection = layer.connection {
            if #available(iOS 17.0, *) {
                if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
            } else if connection.isVideoOrientationSupported {
                connection.videoOrientation = .portrait
            }
        }
        superview.layer.insertSublayer(layer, at: 0)
        previewLayer = layer
    }

    private func detachPreview() {
        previewLayer?.removeFromSuperlayer()
        previewLayer = nil
        // 투명 WebView는 유지 — 웹 쪽 배경(다크 테마)이 다시 칠한다
    }

    public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard running, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return }
        let srcW = CVPixelBufferGetWidth(pixelBuffer)
        let srcH = CVPixelBufferGetHeight(pixelBuffer)
        let stride = CVPixelBufferGetBytesPerRow(pixelBuffer)
        let src = base.assumingMemoryBound(to: UInt8.self)

        var luma = [UInt8](repeating: 0, count: roiW * roiH)
        var rgb = [UInt8](repeating: 0, count: roiW * roiH * 3)
        for y in 0..<roiH {
            let sy = y * srcH / roiH
            let rowBase = sy * stride
            for x in 0..<roiW {
                let sx = x * srcW / roiW
                let p = rowBase + sx * 4 // BGRA
                let b = Int(src[p])
                let g = Int(src[p + 1])
                let r = Int(src[p + 2])
                let i = y * roiW + x
                luma[i] = UInt8((r * 77 + g * 150 + b * 29) >> 8) // 웹 camera.ts와 동일 공식
                rgb[i * 3] = UInt8(r)
                rgb[i * 3 + 1] = UInt8(g)
                rgb[i * 3 + 2] = UInt8(b)
            }
        }

        let tMs = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer)) * 1000
        batch.append([
            "t": tMs,
            "l": Data(luma).base64EncodedString(),
            "c": Data(rgb).base64EncodedString(),
        ])
        if batch.count >= batchSize {
            let frames = batch
            batch.removeAll()
            notifyListeners("frames", data: ["frames": frames])
        }
    }
}
