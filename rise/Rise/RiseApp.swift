import SwiftUI

@main
struct RiseApp: App {
    @State private var store = RiseStore.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
                .tint(.orange)
                .task {
                    await AlarmScheduler.requestAuthorization()
                    await ChallengeCoordinator.requestNotificationPermission()
                    await AlarmScheduler.syncAll(store.alarms)
                    await ChallengeCoordinator.reconcile()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await ChallengeCoordinator.reconcile() }
                    }
                }
        }
    }
}
