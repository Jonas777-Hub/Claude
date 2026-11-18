import SwiftUI

struct SettingsView: View {
    @Environment(RiseStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var apiKey = Keychain.apiKey ?? ""
    @State private var keyStatus: String?
    @State private var testing = false

    var body: some View {
        @Bindable var store = store
        NavigationStack {
            Form {
                Section {
                    Stepper(value: $store.followUpMinutes, in: 5...180, step: 5) {
                        Text("Erneut klingeln nach \(store.followUpMinutes) Min.")
                    }
                } header: {
                    Text("Wenn Aufgaben offen bleiben")
                } footer: {
                    Text("Nach dem Ausschalten hast du so viel Zeit für deine Aufgaben. Danach klingelt der Wecker wieder, so lange, bis alles erledigt ist.")
                }

                Section {
                    SecureField("sk-ant-…", text: $apiKey)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Sichern und testen") {
                        Keychain.apiKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard let key = Keychain.apiKey else {
                            keyStatus = "Kein Schlüssel – Fotos werden auf dem iPhone verglichen."
                            return
                        }
                        testing = true
                        Task {
                            keyStatus = await ClaudeCheck.testKey(key)
                            testing = false
                        }
                    }
                    .disabled(testing)
                    if testing { ProgressView() }
                    if let keyStatus { Text(keyStatus).font(.footnote) }
                } header: {
                    Text("KI-Fotoprüfung (Claude)")
                } footer: {
                    Text("Mit einem API-Schlüssel von console.anthropic.com prüft Claude deine Fotos. Der Schlüssel bleibt im Schlüsselbund des iPhones. Ohne Schlüssel vergleicht Rise die Fotos direkt auf dem Gerät mit deinem Referenzfoto.")
                }

                Section("Berechtigungen") {
                    Button("iOS-Einstellungen für Rise öffnen") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                    Text(AlarmScheduler.isAuthorized ? "Wecker erlaubt ✓" : "Wecker nicht erlaubt – bitte in den Einstellungen erlauben.")
                        .font(.footnote)
                        .foregroundStyle(AlarmScheduler.isAuthorized ? .green : .red)
                }
            }
            .navigationTitle("Einstellungen")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } }
            }
        }
    }
}
