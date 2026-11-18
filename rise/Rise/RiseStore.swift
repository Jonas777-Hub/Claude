import Foundation
import Observation
import UIKit

/// Speichert Wecker, Einstellungen und den offenen Aufgaben-Zustand als JSON.
@MainActor
@Observable
final class RiseStore {
    static let shared = RiseStore()

    var alarms: [RiseAlarm] = [] { didSet { save() } }
    var pending: PendingChallenge? { didSet { save() } }
    /// Nach wie vielen Minuten der Wecker erneut klingelt, wenn die Aufgaben nicht erledigt sind.
    var followUpMinutes: Int = 60 { didSet { save() } }
    var lastCompletedAt: Date? { didSet { save() } }

    private var isLoading = false

    private struct Snapshot: Codable {
        var alarms: [RiseAlarm]
        var pending: PendingChallenge?
        var followUpMinutes: Int
        var lastCompletedAt: Date?
    }

    private init() { load() }

    // MARK: Abfragen

    func alarm(id: UUID) -> RiseAlarm? { alarms.first { $0.id == id } }

    var pendingAlarm: RiseAlarm? { pending.flatMap { alarm(id: $0.configID) } }

    func upsert(_ alarm: RiseAlarm) {
        if let i = alarms.firstIndex(where: { $0.id == alarm.id }) {
            alarms[i] = alarm
        } else {
            alarms.append(alarm)
        }
        alarms.sort { ($0.hour, $0.minute) < ($1.hour, $1.minute) }
    }

    func delete(_ alarm: RiseAlarm) {
        alarm.tasks.compactMap(\.referenceFile).forEach(deleteReference)
        alarms.removeAll { $0.id == alarm.id }
    }

    // MARK: Referenzfotos

    private var referencesDir: URL {
        let dir = URL.documentsDirectory.appending(path: "References", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func saveReference(_ image: UIImage) -> String? {
        let name = UUID().uuidString + ".jpg"
        guard let data = image.resized(maxSide: 1280).jpegData(compressionQuality: 0.8) else { return nil }
        do {
            try data.write(to: referencesDir.appending(path: name), options: .atomic)
            return name
        } catch {
            return nil
        }
    }

    func reference(_ name: String?) -> UIImage? {
        guard let name else { return nil }
        return UIImage(contentsOfFile: referencesDir.appending(path: name).path())
    }

    func deleteReference(_ name: String) {
        try? FileManager.default.removeItem(at: referencesDir.appending(path: name))
    }

    // MARK: Speichern / Laden

    private var fileURL: URL {
        let dir = URL.applicationSupportDirectory
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "rise.json")
    }

    private func load() {
        isLoading = true
        defer { isLoading = false }
        guard let data = try? Data(contentsOf: fileURL),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        alarms = snap.alarms
        pending = snap.pending
        followUpMinutes = snap.followUpMinutes
        lastCompletedAt = snap.lastCompletedAt
    }

    private func save() {
        guard !isLoading else { return }
        let snap = Snapshot(alarms: alarms, pending: pending, followUpMinutes: followUpMinutes, lastCompletedAt: lastCompletedAt)
        if let data = try? JSONEncoder().encode(snap) {
            try? data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }
}

extension UIImage {
    /// Verkleinert das Bild (und richtet es dabei auf), damit Upload und Vergleich schnell sind.
    func resized(maxSide: CGFloat) -> UIImage {
        let longest = max(size.width, size.height)
        let scale = min(1, maxSide / max(longest, 1))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: target))
        }
    }
}
