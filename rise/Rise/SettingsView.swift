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
                    Stepper(value: $store.followUpMinutes, in: 1...30) {
                        Text("Zeit für Aufgaben: \(store.followUpMinutes) Min.")
                    }
                } header: {
                    Text("Wenn Aufgaben offen bleiben")
                } footer: {
                    Text("So viel Zeit hast du nach dem Ausschalten für alle Aufgaben. Schaffst du es nicht, klingelt der Wecker wieder, sofort in voller Lautstärke. Das wiederholt sich, bis alles erledigt ist.\n\nDer erste Weckton beginnt ganz leise und wird in 20 Sekunden immer lauter. Wie laut „voll“ ist, bestimmt die Lautstärke unter iOS-Einstellungen › Töne & Haptik.")
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
