import SwiftUI

/// Der Bildschirm nach dem Ausschalten: Aufgaben erledigen, sonst klingelt es wieder.
struct ChallengeView: View {
    @Environment(RiseStore.self) private var store

    @State private var photoTask: RiseTask?
    @State private var pushupTask: RiseTask?
    @State private var checking = false
    @State private var feedback: String?
    @State private var feedbackOK = false

    var body: some View {
        NavigationStack {
            Group {
                if let alarm = store.pendingAlarm, let pending = store.pending {
                    content(alarm: alarm, pending: pending)
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Guten Morgen ☀️")
        }
        .interactiveDismissDisabled()
        .fullScreenCover(item: $photoTask) { task in
            CameraPicker { image in
                photoTask = nil
                if let image { check(image, for: task) }
            }
            .ignoresSafeArea()
        }
        .fullScreenCover(item: $pushupTask) { task in
            PushupChallengeView(target: task.count) {
                ChallengeCoordinator.markDone(task)
                pushupTask = nil
            } onCancel: {
                pushupTask = nil
            }
        }
    }

    @ViewBuilder
    private func content(alarm: RiseAlarm, pending: PendingChallenge) -> some View {
        let done = alarm.tasks.filter { pending.completedTaskIDs.contains($0.id) }.count
        let allDone = done == alarm.tasks.count

        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    if allDone {
                        Text("Alles erledigt! 🎉").font(.title2.bold())
                        Text("Der Nachwecker ist gleich aus.")
                    } else {
                        Text("\(done) von \(alarm.tasks.count) erledigt").font(.title2.bold())
                        TimelineView(.periodic(from: .now, by: 30)) { context in
                            let minutes = max(0, Int(pending.nextRingAt.timeIntervalSince(context.date) / 60))
                            Text("Erledige alles, sonst klingelt der Wecker in \(minutes) Min. wieder (\(pending.nextRingAt.formatted(date: .omitted, time: .shortened)) Uhr).")
                                .foregroundStyle(.secondary)
                        }
                    }
                    ProgressView(value: Double(done), total: Double(max(alarm.tasks.count, 1)))
                }
                .padding(.vertical, 6)
            }

            Section("Aufgaben") {
                ForEach(alarm.tasks) { task in
                    let isDone = pending.completedTaskIDs.contains(task.id)
                    Button {
                        start(task)
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: isDone ? "checkmark.circle.fill" : task.systemImage)
                                .font(.title2)
                                .foregroundStyle(isDone ? .green : .orange)
                                .frame(width: 32)
                            VStack(alignment: .leading) {
                                Text(task.title).foregroundStyle(.primary).strikethrough(isDone)
                                Text(isDone ? "Erledigt" : (task.kind == .photo ? "Tippen zum Fotografieren" : "Tippen, Kamera zählt mit"))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if !isDone { Image(systemName: "chevron.right").foregroundStyle(.tertiary) }
                        }
                        .padding(.vertical, 6)
                    }
                    .disabled(isDone || checking)
                }
            }

            if checking {
                Section { HStack { ProgressView(); Text("Foto wird geprüft …") } }
            }
            if let feedback {
                Section {
                    Label(feedback, systemImage: feedbackOK ? "checkmark.seal.fill" : "xmark.octagon.fill")
                        .foregroundStyle(feedbackOK ? .green : .red)
                }
            }

            if allDone {
                Section {
                    Button {
                        ChallengeCoordinator.finish()
                    } label: {
                        Text("Fertig – Wecker aus")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .listRowBackground(Color.clear)
                }
            }
        }
    }

    private func start(_ task: RiseTask) {
        feedback = nil
        switch task.kind {
        case .photo: photoTask = task
        case .pushups: pushupTask = task
        }
    }

    private func check(_ image: UIImage, for task: RiseTask) {
        checking = true
        feedback = nil
        let reference = store.reference(task.referenceFile)
        Task {
            let verdict = await PhotoVerifier.verify(photo: image, task: task, reference: reference)
            checking = false
            feedbackOK = verdict.accepted
            feedback = verdict.message
            if verdict.accepted {
                ChallengeCoordinator.markDone(task)
            }
        }
    }
}

/// Liegestütze mit Live-Kamera zählen.
struct PushupChallengeView: View {
    let target: Int
    let onDone: () -> Void
    let onCancel: () -> Void

    @StateObject private var detector = PushupDetector()

    var body: some View {
        ZStack {
            CameraPreview(session: detector.session)
                .ignoresSafeArea()
                .scaleEffect(x: -1, y: 1) // Spiegelbild wie bei Selfies

            VStack(spacing: 16) {
                HStack {
                    Button("Abbrechen", action: onCancel)
                        .buttonStyle(.bordered)
                    Spacer()
                }
                Spacer()
                Text("\(min(detector.count, target)) / \(target)")
                    .font(.system(size: 88, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .shadow(radius: 8)
                Text(statusText)
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .padding(12)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                Spacer().frame(height: 30)
            }
            .padding()
        }
        .background(Color.black)
        .onAppear { detector.start() }
        .onDisappear { detector.stop() }
        .onChange(of: detector.count) { _, count in
            if count >= target {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                detector.stop()
                onDone()
            } else {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
        }
    }

    private var statusText: String {
        if let error = detector.cameraError { return error }
        if !detector.bodyVisible {
            return "Stell das iPhone hochkant ca. 1,5 m seitlich neben dich, sodass Schulter, Ellbogen und Hand zu sehen sind."
        }
        if let angle = detector.elbowAngle {
            return angle < PushupDetector.downAngle ? "Unten – jetzt hochdrücken!" : "Arme strecken, dann tief runter."
        }
        return "Los geht's!"
    }
}
