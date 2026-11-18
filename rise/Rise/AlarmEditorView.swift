import AVFoundation
import SwiftUI

/// Wecker einstellen: Uhrzeit, Tage, Ton und Aufgaben.
struct AlarmEditorView: View {
    @Environment(RiseStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var alarm: RiseAlarm
    let isNew: Bool
    let onSave: (RiseAlarm) -> Void

    @State private var time: Date
    @State private var player: AVAudioPlayer?
    @State private var newPhotoName = ""
    @State private var referenceTaskID: UUID?

    init(alarm: RiseAlarm, isNew: Bool, onSave: @escaping (RiseAlarm) -> Void) {
        _alarm = State(initialValue: alarm)
        self.isNew = isNew
        self.onSave = onSave
        let date = Calendar.current.date(bySettingHour: alarm.hour, minute: alarm.minute, second: 0, of: Date()) ?? Date()
        _time = State(initialValue: date)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Uhrzeit", selection: $time, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.wheel)
                        .labelsHidden()
                        .frame(maxWidth: .infinity)
                }

                Section("Wiederholen") {
                    HStack(spacing: 6) {
                        ForEach(Weekday.ordered) { day in
                            let on = alarm.weekdays.contains(day.rawValue)
                            Button(day.short) { toggle(day) }
                                .buttonStyle(.plain)
                                .frame(maxWidth: .infinity, minHeight: 36)
                                .background(on ? Color.orange : Color.secondary.opacity(0.15), in: Circle())
                                .foregroundStyle(on ? .white : .primary)
                        }
                    }
                    Text(alarm.repeatText).font(.footnote).foregroundStyle(.secondary)
                }

                Section("Name") {
                    TextField("Aufstehen", text: $alarm.label)
                }

                Section("Ton") {
                    ForEach(AlarmSound.all) { sound in
                        HStack {
                            Button {
                                alarm.sound = sound.id
                                preview(sound)
                            } label: {
                                HStack {
                                    Text(sound.name).foregroundStyle(.primary)
                                    Spacer()
                                    if alarm.sound == sound.id {
                                        Image(systemName: "checkmark").foregroundStyle(.orange)
                                    }
                                }
                            }
                        }
                    }
                }

                Section {
                    ForEach($alarm.tasks) { $task in
                        TaskEditorRow(task: $task, reference: store.reference(task.referenceFile)) {
                            referenceTaskID = task.id
                        }
                    }
                    .onDelete { offsets in
                        offsets.map { alarm.tasks[$0] }.compactMap(\.referenceFile).forEach(store.deleteReference)
                        alarm.tasks.remove(atOffsets: offsets)
                    }
                    .onMove { alarm.tasks.move(fromOffsets: $0, toOffset: $1) }

                    Button {
                        alarm.tasks.append(.pushups(5))
                    } label: {
                        Label("Liegestütze hinzufügen", systemImage: "figure.strengthtraining.traditional")
                    }
                    HStack {
                        TextField("Foto von … (z. B. Sofa)", text: $newPhotoName)
                        Button {
                            alarm.tasks.append(.photo(newPhotoName.trimmingCharacters(in: .whitespaces)))
                            newPhotoName = ""
                        } label: {
                            Label("Foto", systemImage: "camera.fill")
                        }
                        .disabled(newPhotoName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } header: {
                    Text("Aufgaben nach dem Aufwachen")
                } footer: {
                    Text("Nach dem Ausschalten musst du alle Aufgaben erledigen. Sonst klingelt der Wecker nach \(store.followUpMinutes) Minuten wieder. Tipp: Nimm für jedes Foto ein Referenzfoto auf, dann kann die App genau prüfen.")
                }
            }
            .navigationTitle(isNew ? "Neuer Wecker" : "Wecker bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") {
                        player?.stop()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") {
                        player?.stop()
                        let parts = Calendar.current.dateComponents([.hour, .minute], from: time)
                        alarm.hour = parts.hour ?? 6
                        alarm.minute = parts.minute ?? 0
                        alarm.isEnabled = true
                        if alarm.label.trimmingCharacters(in: .whitespaces).isEmpty { alarm.label = "Aufstehen" }
                        onSave(alarm)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) { EditButton() }
            }
            .fullScreenCover(isPresented: Binding(get: { referenceTaskID != nil }, set: { if !$0 { referenceTaskID = nil } })) {
                CameraPicker { image in
                    if let image, let id = referenceTaskID,
                       let index = alarm.tasks.firstIndex(where: { $0.id == id }),
                       let file = store.saveReference(image) {
                        if let old = alarm.tasks[index].referenceFile { store.deleteReference(old) }
                        alarm.tasks[index].referenceFile = file
                    }
                    referenceTaskID = nil
                }
                .ignoresSafeArea()
            }
        }
    }

    private func toggle(_ day: Weekday) {
        if let i = alarm.weekdays.firstIndex(of: day.rawValue) {
            alarm.weekdays.remove(at: i)
        } else {
            alarm.weekdays.append(day.rawValue)
        }
    }

    private func preview(_ sound: AlarmSound) {
        player?.stop()
        guard let url = Bundle.main.url(forResource: sound.id, withExtension: "wav") else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback)
        player = try? AVAudioPlayer(contentsOf: url)
        player?.play()
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [player] in player?.stop() }
    }
}

private struct TaskEditorRow: View {
    @Binding var task: RiseTask
    let reference: UIImage?
    let onTakeReference: () -> Void

    var body: some View {
        switch task.kind {
        case .pushups:
            Stepper(value: $task.count, in: 1...100) {
                Label("\(task.count) Liegestütze", systemImage: task.systemImage)
            }
        case .photo:
            HStack {
                Label {
                    TextField("Objekt", text: $task.name)
                } icon: {
                    Image(systemName: task.systemImage)
                }
                Spacer()
                Button(action: onTakeReference) {
                    if let reference {
                        Image(uiImage: reference)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 44, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        Label("Referenz", systemImage: "camera.badge.ellipsis")
                            .font(.caption)
                    }
                }
                .buttonStyle(.bordered)
            }
        }
    }
}
