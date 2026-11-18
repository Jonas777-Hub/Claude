import SwiftUI
import UIKit

/// Öffnet direkt die Kamera (keine Fotomediathek – alte Fotos zählen nicht).
struct CameraPicker: UIViewControllerRepresentable {
    let onFinish: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            let alert = UIAlertController(title: "Keine Kamera", message: "Auf diesem Gerät ist keine Kamera verfügbar.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in onFinish(nil) })
            return alert
        }
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onFinish: (UIImage?) -> Void
        init(onFinish: @escaping (UIImage?) -> Void) { self.onFinish = onFinish }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onFinish(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onFinish(nil)
        }
    }
}
