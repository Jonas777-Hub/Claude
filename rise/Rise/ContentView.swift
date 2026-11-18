import SwiftUI

/// Startseite: Liste der Wecker.
struct ContentView: View {
    @Environment(RiseStore.self) private var store
    @State private var editing: RiseAlarm?
    @State private var showSettings = false
    @State private var errorMessage: String?
    @State private var infoMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if store.alarms.isEmpty {
                    ContentUnavailableView("Noch kein Wecker",
                                           systemImage: "alarm",
                                           description: Text("Tippe auf +, stell eine Uhrzeit ein und leg fest, was du nach dem Aufstehen erledigen musst."))
                }
                ForEach(store.alarms) { alarm in
                    AlarmRow(alarm: alarm) { enabled in
                        var updated = alarm
                        updated.isEnabled = enabled
                        save(updated)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { editing = alarm }
                    .swipeActions(edge: .trailing) {
                        Button("Löschen", role: .destructive) {
                            AlarmScheduler.cancel(alarm)
                            store.delete(alarm)
                        }
                    }
                    .swipeActions(edge: .leading) {
                        Button("Testen") { test(alarm) }.tint(.blue)
                    }
                }
            }
            .navigationTitle("Rise")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { editing = RiseAlarm() } label: { Image(systemName: "plus") }
                }
            }
            .sheet(item: $editing) { alarm in
                AlarmEditorView(alarm: alarm, isNew: store.alarm(id: alarm.id) == nil) { saved in
                    save(saved)
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .fullScreenCover(isPresented: Binding(get: { store.pending != nil }, set: { _ in })) {
                ChallengeView()
            }
            .alert("Hinweis", isPresented: Binding(get: { errorMessage != nil || infoMessage != nil },
                                                   set: { if !$0 { errorMessage = nil; infoMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? infoMessage ?? "")
            }
        }
    }

    private func save(_ alarm: RiseAlarm) {
        store.upsert(alarm)
        Task {
            do {
                try await AlarmScheduler.sync(alarm)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func test(_ alarm: RiseAlarm) {
        Task {
            do {
                try await AlarmScheduler.scheduleTest(for: alarm)
                infoMessage = "Testwecker klingelt in einer Minute. Sperr das iPhone, um es wie morgens zu erleben."
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct AlarmRow: View {
    let alarm: RiseAlarm
    let onToggle: (Bool) -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(alarm.timeText)
                    .font(.system(size: 44, weight: .light, design: .rounded))
                    .monospacedDigit()
                Text("\(alarm.label) · \(alarm.repeatText)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if !alarm.tasks.isEmpty {
                    Text(alarm.tasks.map(\.title).joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.orange)
                        .lineLimit(2)
                }
            }
            Spacer()
            Toggle("", isOn: Binding(get: { alarm.isEnabled }, set: onToggle))
                .labelsHidden()
        }
        .opacity(alarm.isEnabled ? 1 : 0.5)
        .padding(.vertical, 4)
    }
}
