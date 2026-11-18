import AlarmKit
import AppIntents
import Foundation

/// Läuft, wenn auf dem Sperrbildschirm „Aus“ gedrückt wird.
/// Der Wecker verstummt, die Aufgaben werden fällig und ein Nachwecker wird geplant.
struct RiseStopIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Wecker ausschalten"
    static let description = IntentDescription("Schaltet den Rise-Wecker aus und startet die Aufgaben.")

    @Parameter(title: "Alarm-ID") var alarmID: String
    @Parameter(title: "Wecker-ID") var configID: String

    init() {}

    init(alarmID: String, configID: String) {
        self.alarmID = alarmID
        self.configID = configID
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        await ChallengeCoordinator.alarmDismissed(alarmID: UUID(uuidString: alarmID),
                                                  configID: UUID(uuidString: configID))
        return .result()
    }
}

/// Läuft bei „Aufgaben“: wie „Aus“, öffnet aber direkt die App mit den Aufgaben.
struct RiseOpenTasksIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Aufgaben öffnen"
    static let description = IntentDescription("Schaltet den Wecker aus und öffnet die Aufgaben.")
    static let openAppWhenRun = true

    @Parameter(title: "Alarm-ID") var alarmID: String
    @Parameter(title: "Wecker-ID") var configID: String

    init() {}

    init(alarmID: String, configID: String) {
        self.alarmID = alarmID
        self.configID = configID
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        await ChallengeCoordinator.alarmDismissed(alarmID: UUID(uuidString: alarmID),
                                                  configID: UUID(uuidString: configID))
        return .result()
    }
}
