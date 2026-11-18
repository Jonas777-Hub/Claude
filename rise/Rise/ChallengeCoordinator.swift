import Foundation
import UserNotifications

/// Die Weck-Logik:
/// 1. Wecker klingelt → du schaltest ihn ganz normal aus.
/// 2. Die Aufgaben werden fällig und ein Nachwecker wird in `followUpMinutes` (Standard 5) geplant.
/// 3. Sind alle Aufgaben erledigt, wird der Nachwecker gelöscht – Ruhe bis zum nächsten Weckertag.
/// 4. Sonst klingelt der Nachwecker – sofort laut –, und nach dem Ausschalten laufen wieder 5 Minuten.
@MainActor
enum ChallengeCoordinator {
    private static let notificationID = "rise.tasks"

    static func alarmDismissed(alarmID: UUID?, configID: UUID?) async {
        if let alarmID { AlarmScheduler.stopSystemAlarm(id: alarmID) }

        let store = RiseStore.shared
        guard let configID, let alarm = store.alarm(id: configID), !alarm.tasks.isEmpty else { return }

        let nextRing = Date().addingTimeInterval(TimeInterval(store.followUpMinutes * 60))

        if var pending = store.pending, pending.configID == configID {
            // Nachwecker hat geklingelt (oder Hauptwecker erneut): weiter mit demselben Fortschritt.
            AlarmScheduler.cancelSystemAlarm(id: pending.followUpAlarmID)
            pending.rings += 1
            pending.nextRingAt = nextRing
            pending.followUpAlarmID = try? await AlarmScheduler.scheduleFollowUp(for: alarm, at: nextRing)
            store.pending = pending
        } else {
            if let old = store.pending { AlarmScheduler.cancelSystemAlarm(id: old.followUpAlarmID) }
            var pending = PendingChallenge(configID: configID, startedAt: Date(), nextRingAt: nextRing)
            pending.followUpAlarmID = try? await AlarmScheduler.scheduleFollowUp(for: alarm, at: nextRing)
            store.pending = pending
        }

        await postTaskNotification(for: alarm)
    }

    static func markDone(_ task: RiseTask) {
        let store = RiseStore.shared
        guard var pending = store.pending else { return }
        pending.completedTaskIDs.insert(task.id)
        store.pending = pending
    }

    static func isDone(_ task: RiseTask) -> Bool {
        RiseStore.shared.pending?.completedTaskIDs.contains(task.id) ?? false
    }

    static var allDone: Bool {
        let store = RiseStore.shared
        guard let pending = store.pending, let alarm = store.pendingAlarm else { return false }
        return alarm.tasks.allSatisfy { pending.completedTaskIDs.contains($0.id) }
    }

    /// Alle Aufgaben erledigt: Nachwecker löschen.
    static func finish() {
        let store = RiseStore.shared
        if let pending = store.pending {
            AlarmScheduler.cancelSystemAlarm(id: pending.followUpAlarmID)
        }
        store.pending = nil
        store.lastCompletedAt = Date()
        // Einmalige Wecker nach dem Klingeln ausschalten, damit die Liste stimmt.
        for alarm in store.alarms where alarm.weekdays.isEmpty && alarm.isEnabled && !AlarmScheduler.isScheduled(id: alarm.id) {
            var updated = alarm
            updated.isEnabled = false
            store.upsert(updated)
        }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        center.removeDeliveredNotifications(withIdentifiers: [notificationID])
    }

    /// Beim Öffnen der App prüfen: Falls der Nachwecker fehlt (z. B. nach einem Neustart), neu planen.
    static func reconcile() async {
        let store = RiseStore.shared
        guard var pending = store.pending else { return }
        guard let alarm = store.pendingAlarm, !alarm.tasks.isEmpty else {
            store.pending = nil
            return
        }
        if allDone {
            finish()
            return
        }
        let scheduled = pending.followUpAlarmID.map(AlarmScheduler.isScheduled(id:)) ?? false
        if !scheduled {
            let next = max(pending.nextRingAt, Date().addingTimeInterval(60))
            pending.nextRingAt = next
            pending.followUpAlarmID = try? await AlarmScheduler.scheduleFollowUp(for: alarm, at: next)
            store.pending = pending
        }
    }

    static func requestNotificationPermission() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
    }

    /// Die Nachricht mit den Aufgaben, die nach dem Ausschalten auf dem Sperrbildschirm erscheint.
    private static func postTaskNotification(for alarm: RiseAlarm) async {
        let content = UNMutableNotificationContent()
        content.title = "Jetzt sofort erledigen:"
        content.body = alarm.tasks.map { "• " + $0.title }.joined(separator: "\n")
            + "\n\nDu hast \(RiseStore.shared.followUpMinutes) Min. Sonst klingelt der Wecker wieder – lauter."
        content.interruptionLevel = .timeSensitive
        content.sound = nil
        let request = UNNotificationRequest(identifier: notificationID, content: content,
                                            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
        try? await UNUserNotificationCenter.current().add(request)
    }
}
