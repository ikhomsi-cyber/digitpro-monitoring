import SwiftUI

@main
struct DigitProApp: App {
    @StateObject private var store = AppStore()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("digitpro.appearance") private var appearance = "dark"
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environment(\.locale, Locale(identifier: "fr_FR"))
                .preferredColorScheme(colorTheme == "obsidian" ? .dark : appearance == "system" ? nil : appearance == "light" ? .light : .dark)
                .overlay {
                    if scenePhase != .active && store.signedIn {
                        PageBackground().overlay { BrandMark(size: 70) }.ignoresSafeArea()
                    }
                }
                .task { await store.restore() }
                .onChange(of: scenePhase) { _, phase in if phase == .background { store.protect() } }
                .alert("DigitPro", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) {
                    Button("OK") { store.error = nil }
                } message: { Text(store.error ?? "") }
        }
    }
}
struct RootView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        Group {
            if let message = store.configurationError {
                ContentUnavailableView("Configuration requise", systemImage: "gearshape", description: Text(message))
                    .background { PageBackground() }
            } else if store.restoring {
                ZStack {
                    PageBackground()
                    VStack(spacing: 24) { BrandMark(size: 70); Text("DigitPro").font(.largeTitle.bold()); ProgressView() }
                }
            } else if !store.signedIn { LoginView() }
            else if store.locked {
                ZStack {
                    PageBackground()
                    VStack(spacing: 22) {
                        SymbolBadge(symbol: "faceid", color: DP.accent)
                        Text("Votre espace est protégé").font(.title2.bold())
                        Text("Vos finances, en toute confidentialité.").foregroundStyle(.secondary)
                        Button("Déverrouiller") { Task { await store.unlock() } }.buttonStyle(PrimaryButtonStyle())
                        Button("Se déconnecter") { Task { await store.signOut() } }.font(.subheadline)
                    }.frame(maxWidth: 400).padding(28)
                }
            } else { MainTabs() }
        }
        .tint(DP.tint(scheme))
        .toolbarBackground(DP.surface(scheme), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}
struct LoginView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focused: Bool
    var body: some View {
        PageScroll {
            HStack(spacing: 12) {
                BrandMark(); Text("DigitPro").font(.system(.title2, design: .rounded, weight: .bold)); Spacer()
                Pill(text: "VOTRE ESPACE", symbol: "lock.shield", color: DP.tint(scheme))
            }.padding(.top, 28)
            VStack(alignment: .leading, spacing: 16) {
                Eyebrow(text: "Clarté. Sérénité. Liberté.")
                Text("Votre activité.\nUne vision claire.")
                    .font(.system(size: 42, weight: .semibold, design: .rounded)).tracking(-1.6)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Trésorerie, revenus et patrimoine.\nTout DigitPro, à portée de main.")
                    .font(.body).foregroundStyle(.secondary).lineSpacing(4)
            }.padding(.vertical, 22)
            DPCard {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Heureux de vous retrouver").font(.title3.weight(.semibold))
                    VStack(alignment: .leading, spacing: 9) {
                        Eyebrow(text: "Adresse e-mail")
                        HStack {
                            Image(systemName: "envelope").foregroundStyle(.secondary)
                            TextField("vous@exemple.fr", text: $email).keyboardType(.emailAddress)
                                .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                        }.padding(15).background(DP.background(scheme).opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
                    }
                    VStack(alignment: .leading, spacing: 9) {
                        Eyebrow(text: "Mot de passe")
                        HStack {
                            Image(systemName: "lock").foregroundStyle(.secondary)
                            SecureField("Votre mot de passe", text: $password).textContentType(.password).focused($focused)
                                .submitLabel(.go).onSubmit { login() }
                        }.padding(15).background(DP.background(scheme).opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
                    }
                    Button(action: login) {
                        HStack { Spacer(); if store.busy { ProgressView().tint(DP.ink) } else { Text("Accéder à mon espace"); Image(systemName: "arrow.right") }; Spacer() }
                    }.buttonStyle(PrimaryButtonStyle()).disabled(email.isEmpty || password.isEmpty || store.busy)
                        .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1)
                }
            }
            Label("Le même compte, sur tous vos appareils.", systemImage: "iphone.and.arrow.right.inward")
                .font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 10)
        }.scrollDismissesKeyboard(.interactively)
    }
    private func login() {
        guard !email.isEmpty, !password.isEmpty, !store.busy else { return }
        focused = false
        Task { await store.signIn(email: email, password: password); password = "" }
    }
}
struct MainTabs: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        TabView(selection: $store.selectedTab) {
            NavigationStack { DashboardView() }.tag(AppTab.dashboard).tabItem { Label("Accueil", systemImage: "square.grid.2x2") }
            NavigationStack { ActivityView() }.tag(AppTab.activity).tabItem { Label("Activité", systemImage: "calendar.badge.clock") }
            NavigationStack { TransactionsView() }.tag(AppTab.transactions).tabItem { Label("Opérations", systemImage: "arrow.left.arrow.right") }
            NavigationStack { ForecastView() }.tag(AppTab.forecast).tabItem { Label("Prévisionnel", systemImage: "chart.xyaxis.line") }
            NavigationStack { FinanceView() }.tag(AppTab.finance).tabItem { Label("Patrimoine", systemImage: "building.2") }
            NavigationStack { SettingsView() }.tag(AppTab.settings).tabItem { Label("Réglages", systemImage: "slider.horizontal.3") }
        }.tint(DP.tint(scheme))
    }
}
