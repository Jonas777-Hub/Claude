import ActivityKit
import AlarmKit
import AppIntents
import Foundation
import SwiftUI

/// Hängt an jedem Systemwecker: zu welchem Rise-Wecker er gehört.
struct RiseMetadata: AlarmMetadata {
    var configID: UUID
    var isFollowUp: Bool
}

/// Plant Wecker über AlarmKit (iOS 26). AlarmKit-Wecker klingeln wie der System-Wecker:
/// auf dem Sperrbildschirm, auch im Lautlos- und Fokus-Modus.
@MainActor
enum AlarmScheduler {
    private static var manager: AlarmManager { .shared }

    static var isAuthorized: Bool { manager.authorizationState == .authorized }

    @discardableResult
    static func requestAuthorization() async -> Bool {
        switch manager.authorizationState {
        case .authorized:
            return true
        case .denied:
            return false
        case .notDetermined:
            let state = try? await manager.requestAuthorization()
            return state == .authorized
        @unknown default:
            return false
        }
    }

    /// Plant (oder entfernt) den Hauptwecker. Die ID des Systemweckers ist die ID des Rise-Weckers.
    static func sync(_ alarm: RiseAlarm) async throws {
        try? manager.cancel(id: alarm.id)
        guard alarm.isEnabled else { return }
        guard await requestAuthorization() else { throw SchedulerError.notAuthorized }

        let time = Alarm.Schedule.Relative.Time(hour: alarm.hour, minute: alarm.minute)
        let recurrence: Alarm.Schedule.Relative.Recurrence = alarm.weekdays.isEmpty
            ? .never
            : .weekly(Weekday.ordered.filter { alarm.weekdays.contains($0.rawValue) }.map(\.locale))
        let schedule = Alarm.Schedule.relative(.init(time: time, repeats: recurrence))

        try await scheduleAlert(id: alarm.id, alarm: alarm, title: alarm.label, isFollowUp: false, schedule: schedule)
    }

    static func syncAll(_ alarms: [RiseAlarm]) async {
        for alarm in alarms { try? await sync(alarm) }
    }

    static func cancel(_ alarm: RiseAlarm) {
        try? manager.cancel(id: alarm.id)
    }

    /// Nachwecker: klingelt einmalig zum angegebenen Zeitpunkt, wenn die Aufgaben noch offen sind.
    static func scheduleFollowUp(for alarm: RiseAlarm, at date: Date) async throws -> UUID {
        let id = UUID()
        try await scheduleAlert(id: id, alarm: alarm, title: "Aufgaben noch offen!", isFollowUp: true, schedule: .fixed(date))
        return id
    }

    /// Testwecker in einer Minute (verhält sich wie der echte Wecker).
    static func scheduleTest(for alarm: RiseAlarm) async throws {
        guard await requestAuthorization() else { throw SchedulerError.notAuthorized }
        try await scheduleAlert(id: UUID(), alarm: alarm, title: alarm.label, isFollowUp: false,
                                schedule: .fixed(Date().addingTimeInterval(60)))
    }

    static func cancelSystemAlarm(id: UUID?) {
        guard let id else { return }
        try? manager.cancel(id: id)
    }

    static func stopSystemAlarm(id: UUID) {
        try? manager.stop(id: id)
    }

    static func isScheduled(id: UUID) -> Bool {
        let alarms = (try? manager.alarms) ?? []
        return alarms.contains { $0.id == id }
    }

    private static func scheduleAlert(id: UUID, alarm: RiseAlarm, title: String, isFollowUp: Bool,
                                      schedule: Alarm.Schedule) async throws {
        let stopButton = AlarmButton(text: "Aus", textColor: .white, systemImageName: "stop.circle")
        let taskButton = AlarmButton(text: "Aufgaben", textColor: .white, systemImageName: "checklist")
        let alert = AlarmPresentation.Alert(title: "\(title)",
                                            stopButton: stopButton,
                                            secondaryButton: taskButton,
                                            secondaryButtonBehavior: .custom)
        let attributes = AlarmAttributes<RiseMetadata>(
            presentation: AlarmPresentation(alert: alert),
            metadata: RiseMetadata(configID: alarm.id, isFollowUp: isFollowUp),
            tintColor: .orange)

        let configuration = AlarmManager.AlarmConfiguration<RiseMetadata>(
            countdownDuration: nil,
            schedule: schedule,
            attributes: attributes,
            stopIntent: RiseStopIntent(alarmID: id.uuidString, configID: alarm.id.uuidString),
            secondaryIntent: RiseOpenTasksIntent(alarmID: id.uuidString, configID: alarm.id.uuidString),
            sound: .named(AlarmSound.named(alarm.sound).fileName))

        _ = try await manager.schedule(id: id, configuration: configuration)
    }

    enum SchedulerError: LocalizedError {
        case notAuthorized
        var errorDescription: String? {
            "Rise darf keine Wecker stellen. Erlaube es unter Einstellungen › Rise › Wecker."
        }
    }
}
