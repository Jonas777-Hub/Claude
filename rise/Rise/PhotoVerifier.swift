import Foundation
import UIKit
import Vision

/// Prüft, ob das Foto wirklich das verlangte Objekt zeigt.
///
/// 1. Mit API-Schlüssel: Claude vergleicht das neue Foto mit dem Referenzfoto (oder prüft den Namen).
/// 2. Ohne Schlüssel oder ohne Internet: Bildvergleich auf dem iPhone (Apple Vision).
enum PhotoVerifier {
    struct Verdict {
        let accepted: Bool
        let message: String
    }

    static func verify(photo: UIImage, task: RiseTask, reference: UIImage?) async -> Verdict {
        let photo = photo.resized(maxSide: 1024)
        let reference = reference?.resized(maxSide: 1024)

        if let key = Keychain.apiKey {
            do {
                return try await ClaudeCheck.verify(photo: photo, reference: reference, objectName: task.name, apiKey: key)
            } catch {
                // Kein Internet o. Ä.: auf dem Gerät weiterprüfen.
                if let reference {
                    var verdict = onDevice(photo: photo, reference: reference)
                    verdict = Verdict(accepted: verdict.accepted, message: verdict.message + " (offline geprüft)")
                    return verdict
                }
                return Verdict(accepted: true, message: "KI nicht erreichbar – ohne Referenzfoto akzeptiert.")
            }
        }

        if let reference { return onDevice(photo: photo, reference: reference) }
        return Verdict(accepted: true,
                       message: "Ohne API-Schlüssel und Referenzfoto kann ich nicht prüfen – akzeptiert.")
    }

    // MARK: Auf dem Gerät

    /// Abstand zweier Bild-Merkmale. Kleiner = ähnlicher. Ab diesem Wert gilt das Foto als „anderes Motiv“.
    static let onDeviceThreshold: Float = 0.75

    static func onDevice(photo: UIImage, reference: UIImage) -> Verdict {
        guard let a = featurePrint(photo), let b = featurePrint(reference) else {
            return Verdict(accepted: true, message: "Bildvergleich nicht möglich – akzeptiert.")
        }
        var distance: Float = 0
        do {
            try a.computeDistance(&distance, to: b)
        } catch {
            return Verdict(accepted: true, message: "Bildvergleich nicht möglich – akzeptiert.")
        }
        if distance <= onDeviceThreshold {
            return Verdict(accepted: true, message: "Passt zum Referenzfoto.")
        }
        return Verdict(accepted: false,
                       message: "Sieht nicht aus wie dein Referenzfoto. Geh hin und fotografiere es aus ähnlicher Perspektive.")
    }

    private static func featurePrint(_ image: UIImage) -> VNFeaturePrintObservation? {
        guard let cg = image.cgImage else { return nil }
        let request = VNGenerateImageFeaturePrintRequest()
        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        try? handler.perform([request])
        return request.results?.first
    }
}

/// Aufruf der Claude Messages API (REST, da es kein offizielles Swift-SDK gibt).
enum ClaudeCheck {
    static let model = "claude-opus-5-5"
    private static let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    struct CheckError: LocalizedError {
        let errorDescription: String?
    }

    private struct Result: Decodable {
        let matches: Bool
        let reason: String
    }

    static func verify(photo: UIImage, reference: UIImage?, objectName: String, apiKey: String) async throws -> PhotoVerifier.Verdict {
        guard let photoData = photo.jpegData(compressionQuality: 0.7) else {
            throw CheckError(errorDescription: "Foto konnte nicht gelesen werden.")
        }
        let name = objectName.isEmpty ? "das vorgegebene Objekt" : objectName

        var content: [[String: Any]] = []
        if let reference, let refData = reference.jpegData(compressionQuality: 0.7) {
            content.append(["type": "text", "text": "Bild 1 – Referenzfoto von „\(name)“, vorher vom Nutzer aufgenommen:"])
            content.append(imageBlock(refData))
            content.append(["type": "text", "text": "Bild 2 – gerade eben mit der Kamera aufgenommen:"])
            content.append(imageBlock(photoData))
            content.append(["type": "text", "text": """
                Zeigt Bild 2 dasselbe konkrete Objekt bzw. denselben Ort wie Bild 1 („\(name)“)? \
                Andere Perspektive, anderes Licht oder kleine Veränderungen sind in Ordnung. \
                Lehne ab, wenn es ein anderes Objekt ist, das Bild fast schwarz/unscharf ist \
                oder ein Bildschirm bzw. ein ausgedrucktes Foto abfotografiert wurde.
                """])
        } else {
            content.append(imageBlock(photoData))
            content.append(["type": "text", "text": """
                Zeigt dieses gerade aufgenommene Foto deutlich „\(name)“? \
                Lehne ab, wenn das Objekt nicht klar zu sehen ist, das Bild fast schwarz/unscharf ist \
                oder ein Bildschirm bzw. ein ausgedrucktes Foto abfotografiert wurde.
                """])
        }

        let schema: [String: Any] = [
            "type": "object",
            "properties": [
                "matches": ["type": "boolean"],
                "reason": ["type": "string", "description": "Ein kurzer Satz auf Deutsch, direkt an den Nutzer gerichtet (du)."],
            ],
            "required": ["matches", "reason"],
            "additionalProperties": false,
        ]

        let body: [String: Any] = [
            "model": model,
            "max_tokens": 4096,
            "fallbacks": "default",
            "output_config": [
                "effort": "low",
                "format": ["type": "json_schema", "schema": schema],
            ],
            "system": "Du bist der strenge, aber faire Prüfer einer Wecker-App. Der Nutzer muss nach dem Aufwachen beweisen, dass er aufgestanden ist, indem er ein bestimmtes Objekt in seiner Wohnung fotografiert.",
            "messages": [["role": "user", "content": content]],
        ]

        var request = URLRequest(url: endpoint, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
        request.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CheckError(errorDescription: "Unerwartete Antwort (HTTP \(status)).")
        }
        guard status == 200 else {
            let message = (json["error"] as? [String: Any])?["message"] as? String ?? "HTTP \(status)"
            throw CheckError(errorDescription: message)
        }
        if json["stop_reason"] as? String == "refusal" {
            throw CheckError(errorDescription: "Die KI hat die Prüfung abgelehnt.")
        }
        let blocks = json["content"] as? [[String: Any]] ?? []
        guard let text = blocks.first(where: { $0["type"] as? String == "text" })?["text"] as? String,
              let result = try? JSONDecoder().decode(Result.self, from: Data(text.utf8)) else {
            throw CheckError(errorDescription: "Antwort der KI nicht lesbar.")
        }
        return PhotoVerifier.Verdict(accepted: result.matches, message: result.reason)
    }

    private static func imageBlock(_ jpeg: Data) -> [String: Any] {
        ["type": "image", "source": ["type": "base64", "media_type": "image/jpeg", "data": jpeg.base64EncodedString()]]
    }

    /// Kleiner Test für die Einstellungen: Ist der Schlüssel gültig?
    static func testKey(_ apiKey: String) async -> String {
        var request = URLRequest(url: endpoint, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
        let body: [String: Any] = [
            "model": model,
            "max_tokens": 1024,
            "output_config": ["effort": "low"],
            "messages": [["role": "user", "content": "Antworte nur mit: OK"]],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 200 { return "Schlüssel funktioniert ✓" }
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let message = (json?["error"] as? [String: Any])?["message"] as? String ?? ""
            return "Fehler \(status): \(message)"
        } catch {
            return "Keine Verbindung: \(error.localizedDescription)"
        }
    }
}
