import AVFoundation
import Combine
import SwiftUI
import Vision

/// Zählt Liegestütze mit der Frontkamera: Apple Vision erkennt Schulter, Ellbogen und Handgelenk,
/// aus dem Ellbogenwinkel ergibt sich „unten“ (< 100°) und „oben“ (> 150°). Unten → oben = 1 Liegestütz.
final class PushupDetector: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    @Published private(set) var count = 0
    @Published private(set) var bodyVisible = false
    @Published private(set) var elbowAngle: Double?
    @Published private(set) var cameraError: String?

    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "rise.pushups")
    private let request = VNDetectHumanBodyPoseRequest()
    private var configured = false
    private var isDown = false
    private var internalCount = 0
    private var smoothedAngle: Double?

    static let downAngle: Double = 100
    static let upAngle: Double = 150

    func start() {
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            guard let self else { return }
            guard granted else {
                DispatchQueue.main.async { self.cameraError = "Kein Kamerazugriff. Erlaube ihn unter Einstellungen › Rise." }
                return
            }
            self.queue.async {
                self.configureIfNeeded()
                if !self.session.isRunning { self.session.startRunning() }
            }
        }
    }

    func stop() {
        queue.async { if self.session.isRunning { self.session.stopRunning() } }
    }

    private func configureIfNeeded() {
        guard !configured else { return }
        configured = true
        session.beginConfiguration()
        session.sessionPreset = .high
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            session.commitConfiguration()
            DispatchQueue.main.async { self.cameraError = "Frontkamera nicht verfügbar." }
            return
        }
        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: queue)
        if session.canAddOutput(output) { session.addOutput(output) }
        if let connection = output.connection(with: .video), connection.isVideoRotationAngleSupported(90) {
            connection.videoRotationAngle = 90 // Hochformat
        }
        session.commitConfiguration()
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let width = Double(CVPixelBufferGetWidth(pixelBuffer))
        let height = Double(CVPixelBufferGetHeight(pixelBuffer))

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
        try? handler.perform([request])

        guard let observation = request.results?.first,
              let angle = Self.bestElbowAngle(observation, width: width, height: height) else {
            DispatchQueue.main.async {
                self.bodyVisible = false
                self.elbowAngle = nil
            }
            return
        }

        // Leicht glätten, damit Zittern nicht doppelt zählt.
        let smooth = smoothedAngle.map { $0 * 0.6 + angle * 0.4 } ?? angle
        smoothedAngle = smooth

        if !isDown && smooth < Self.downAngle {
            isDown = true
        } else if isDown && smooth > Self.upAngle {
            isDown = false
            internalCount += 1
        }

        let newCount = internalCount
        DispatchQueue.main.async {
            self.bodyVisible = true
            self.elbowAngle = smooth
            self.count = newCount
        }
    }

    /// Ellbogenwinkel der besser sichtbaren Körperseite (in Grad).
    private static func bestElbowAngle(_ obs: VNHumanBodyPoseObservation, width: Double, height: Double) -> Double? {
        guard let points = try? obs.recognizedPoints(.all) else { return nil }
        let sides: [(VNHumanBodyPoseObservation.JointName, VNHumanBodyPoseObservation.JointName, VNHumanBodyPoseObservation.JointName)] = [
            (.leftShoulder, .leftElbow, .leftWrist),
            (.rightShoulder, .rightElbow, .rightWrist),
        ]
        var best: (confidence: Float, angle: Double)?
        for (s, e, w) in sides {
            guard let shoulder = points[s], let elbow = points[e], let wrist = points[w] else { continue }
            let confidence = min(shoulder.confidence, elbow.confidence, wrist.confidence)
            guard confidence > 0.3 else { continue }
            let a = CGVector(dx: (shoulder.location.x - elbow.location.x) * width, dy: (shoulder.location.y - elbow.location.y) * height)
            let b = CGVector(dx: (wrist.location.x - elbow.location.x) * width, dy: (wrist.location.y - elbow.location.y) * height)
            let lengths = hypot(a.dx, a.dy) * hypot(b.dx, b.dy)
            guard lengths > 0 else { continue }
            let cosine = max(-1, min(1, (a.dx * b.dx + a.dy * b.dy) / lengths))
            let angle = acos(cosine) * 180 / .pi
            if best == nil || confidence > best!.confidence { best = (confidence, Double(angle)) }
        }
        return best?.angle
    }
}

/// Kamerabild als SwiftUI-View.
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}
}
