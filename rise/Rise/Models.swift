import Foundation

/// Eine Aufgabe, die nach dem Wecker erledigt werden muss.
struct RiseTask: Codable, Hashable, Identifiable {
    enum Kind: String, Codable {
        case pushups
        case photo
    }

    var id = UUID()
    var kind: Kind
    /// Anzahl Liegestütze (nur bei `.pushups`).
    var count: Int = 5
    /// Was fotografiert werden soll, z. B. "Sofa" (nur bei `.photo`).
    var name: String = ""
    /// Dateiname des Referenzfotos in Documents/References (optional).
    var referenceFile: String?

    var title: String {
        switch kind {
        case .pushups: return "\(count) Liegestütze"
        case .photo: return "Foto: \(name.isEmpty ? "Objekt" : name)"
        }
    }

    var systemImage: String {
        switch kind {
        case .pushups: return "figure.strengthtraining.traditional"
        case .photo: return "camera.fill"
        }
    }

    static func pushups(_ count: Int) -> RiseTask { RiseTask(kind: .pushups, count: count) }
    static func photo(_ name: String) -> RiseTask { RiseTask(kind: .photo, name: name) }
}

/// Weckton aus dem App-Bundle (Rise/Sounds). Jeder Ton liegt zweimal vor:
/// `<id>.wav` beginnt ganz leise und wird in 20 s lauter (Hauptwecker),
/// `<id>_laut.wav` ist sofort auf voller Lautstärke (Nachwecker).
struct AlarmSound: Identifiable, Hashable {
    let id: String
    let name: String
    var fileName: String { id + ".wav" }
    var loudFileName: String { id + "_laut.wav" }

    static let all: [AlarmSound] = [
        AlarmSound(id: "klassik", name: "Klassik"),
        AlarmSound(id: "sanft", name: "Sanft"),
        AlarmSound(id: "glocke", name: "Glocke"),
        AlarmSound(id: "digital", name: "Digital"),
        AlarmSound(id: "sirene", name: "Sirene"),
    ]

    static func named(_ id: String) -> AlarmSound { all.first { $0.id == id } ?? all[0] }
}

/// Ein eingestellter Wecker.
struct RiseAlarm: Codable, Hashable, Identifiable {
    var id = UUID()
    var hour: Int = 6
    var minute: Int = 0
    /// Wochentage im Format von `Calendar` (1 = Sonntag … 7 = Samstag). Leer = einmalig.
    var weekdays: [Int] = []
    var label: String = "Aufstehen"
    var sound: String = "klassik"
    var tasks: [RiseTask] = [.pushups(5), .photo("Sofa"), .photo("Schreibtisch"), .photo("Sideboard")]
    var isEnabled = true

    var timeText: String { String(format: "%02d:%02d", hour, minute) }

    var repeatText: String {
        if weekdays.isEmpty { return "Einmalig" }
        let set = Set(weekdays)
        if set == Set(1...7) { return "Jeden Tag" }
        if set == Set(2...6) { return "Werktags" }
        if set == [1, 7] { return "Wochenende" }
        return Weekday.ordered.filter { set.contains($0.rawValue) }.map(\.short).joined(separator: ", ")
    }
}

/// Wochentage in deutscher Reihenfolge (Mo zuerst).
enum Weekday: Int, CaseIterable, Identifiable {
    case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday

    var id: Int { rawValue }

    static let ordered: [Weekday] = [.monday, .tuesday, .wednesday, .thursday, .friday, .saturday, .sunday]

    var short: String {
        switch self {
        case .monday: return "Mo"
        case .tuesday: return "Di"
        case .wednesday: return "Mi"
        case .thursday: return "Do"
        case .friday: return "Fr"
        case .saturday: return "Sa"
        case .sunday: return "So"
        }
    }

    var locale: Locale.Weekday {
        switch self {
        case .monday: return .monday
        case .tuesday: return .tuesday
        case .wednesday: return .wednesday
        case .thursday: return .thursday
        case .friday: return .friday
        case .saturday: return .saturday
        case .sunday: return .sunday
        }
    }
}

/// Der Zustand nach dem Ausschalten: Aufgaben offen, Nachwecker geplant.
struct PendingChallenge: Codable, Hashable {
    var configID: UUID
    var startedAt: Date
    /// Zeitpunkt, an dem der Wecker erneut klingelt, falls die Aufgaben nicht erledigt sind.
    var nextRingAt: Date
    var followUpAlarmID: UUID?
    var completedTaskIDs: Set<UUID> = []
    /// Wie oft der Wecker schon nachgeklingelt hat.
    var rings: Int = 1
}
