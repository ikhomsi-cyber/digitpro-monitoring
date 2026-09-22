import SwiftUI

struct TransactionsView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var rows: [BankTransaction] = []
    @State private var scope = "pro"
    @State private var search = ""
    @State private var nextPage: Int?
    @State private var total = 0
    @State private var loading = false
    @State private var syncingBanks = false
    @State private var syncingProvider = "Qonto"
    @State private var syncMessage: String?
    @State private var error: String?
    @State private var requestID = UUID()
    private var filterKey: String { scope + "|" + search }
    private var days: [String] { Set(rows.map(\.date)).sorted(by: >) }
    var body: some View {
        PageScroll {
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "Chaque mouvement compte")
                Text("Opérations").font(.system(.largeTitle, design: .rounded, weight: .semibold)).tracking(-1)
                Text("Vos comptes pro et perso, au même endroit.").font(.subheadline).foregroundStyle(.secondary)
            }
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Rechercher une opération", text: $search).autocorrectionDisabled().submitLabel(.search)
                if !search.isEmpty { Button { search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }.accessibilityLabel("Effacer la recherche") }
            }.padding(16).background(DP.surface(scheme), in: RoundedRectangle(cornerRadius: 18))
            HStack(spacing: 8) {
                scopeButton("Tout", value: "all", symbol: "square.stack")
                scopeButton("Pro", value: "pro", symbol: "building.2")
                scopeButton("Personnel", value: "personal", symbol: "person")
            }
            if syncingBanks {
                Label("Synchronisation avec \(syncingProvider)…", systemImage: "arrow.triangle.2.circlepath").font(.caption).foregroundStyle(.secondary)
            } else if let syncMessage {
                Label(syncMessage, systemImage: "checkmark.circle").font(.caption).foregroundStyle(DP.tint(scheme))
            }
            if let error { InlineError(message: error) { Task { await load(reset: true) } } }
            if !rows.isEmpty {
                HStack { Eyebrow(text: "Historique"); Spacer(); Text("\(total.formatted()) opérations").font(.caption).foregroundStyle(.secondary) }
                LazyVStack(alignment: .leading, spacing: 20) {
                    ForEach(days, id: \.self) { day in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(dayLabel(day)).font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
                            DPCard {
                                VStack(spacing: 0) {
                                    let items = rows.filter { $0.date == day }
                                    ForEach(Array(items.enumerated()), id: \.element.id) { index, row in
                                        if index > 0 { Divider().padding(.leading, 57) }
                                        NavigationLink { TransactionDetail(row: row) } label: { TransactionRow(row: row) }
                                            .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if loading { ProgressView("Chargement des opérations…").font(.caption).frame(maxWidth: .infinity).padding(25) }
            else if nextPage != nil {
                Button("Voir les opérations suivantes") { Task { await load(reset: false) } }.buttonStyle(PrimaryButtonStyle())
            } else if rows.isEmpty && error == nil {
                ContentUnavailableView("Aucune opération", systemImage: "tray", description: Text("Essayez un autre libellé ou changez de périmètre."))
            }
        }.toolbar(.hidden, for: .navigationBar).scrollDismissesKeyboard(.interactively)
            .refreshable { await syncAndReload() }
            .task(id: filterKey) {
                // Invalidate in-flight pagination immediately, even during search debounce.
                requestID = UUID()
                if let cached = store.transactionPages[filterKey] {
                    rows = cached.transactions; total = cached.total; nextPage = cached.nextPage
                    loading = false; error = nil
                    return
                }
                rows = []; total = 0; nextPage = nil
                do {
                    if !search.isEmpty { try await Task.sleep(for: .milliseconds(300)) }
                    try Task.checkCancellation()
                    await load(reset: true)
                }
                catch { }
            }
    }
    private func syncAndReload() async {
        guard let api = store.api, !syncingBanks else { return }
        let requestedScope = scope
        syncingProvider = requestedScope == "personal" ? "Powens" : requestedScope == "all" ? "Qonto et Powens" : "Qonto"
        syncingBanks = true; syncMessage = nil; error = nil
        defer { syncingBanks = false }
        do {
            try await api.syncTransactions(scope: requestedScope)
            guard store.signedIn else { return }
            store.activitySummary = nil
            store.transactionPages.removeAll()
            store.invalidateExpenses()
            await load(reset: true, preservingRows: true)
            if error == nil { syncMessage = syncingProvider + " · synchronisé à " + Date().formatted(date: .omitted, time: .shortened) }
            // Le Dashboard doit aussi récupérer le nouveau solde Qonto, même si
            // SwiftUI termine la tâche du geste de rafraîchissement.
            let dashboardRefresh = Task.detached { @MainActor [store] in
                await store.refresh()
            }
            await dashboardRefresh.value
        } catch is CancellationError {
            // Le geste de rafraîchissement peut être annulé par SwiftUI lorsque
            // le doigt quitte l’écran. La requête Qonto continue en arrière-plan.
            syncMessage = "Synchronisation \(syncingProvider) en cours…"
        } catch let failure as URLError where failure.code == .cancelled {
            syncMessage = "Synchronisation \(syncingProvider) en cours…"
        } catch {
            if case APIError.expired = error { await store.signOut() }
            else { self.error = "Synchronisation \(syncingProvider) : " + error.localizedDescription }
        }
    }
    private func scopeButton(_ title: String, value: String, symbol: String) -> some View {
        Button { scope = value } label: {
            Label(title, systemImage: symbol).font(.system(size: 12, weight: .semibold))
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .foregroundStyle(scope == value ? DP.ink : (scheme == .dark ? .white.opacity(0.6) : .secondary))
                .background(scope == value ? DP.accent : DP.surface(scheme), in: Capsule())
        }.buttonStyle(.plain).accessibilityAddTraits(scope == value ? .isSelected : [])
    }
    private func load(reset: Bool, preservingRows: Bool = false) async {
        guard let api = store.api else { return }
        let identity = UUID(); requestID = identity
        let requestedFilter = filterKey
        let page = reset ? 0 : (nextPage ?? 0)
        loading = true; error = nil
        if reset && !preservingRows { rows = []; total = 0; nextPage = nil }
        defer { if requestID == identity { loading = false } }
        do {
            let result: TransactionPage = try await api.get("transactions", query: [
                URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "scope", value: scope),
                URLQueryItem(name: "search", value: search)
            ])
            try Task.checkCancellation()
            guard requestID == identity, requestedFilter == filterKey, store.signedIn else { return }
            if reset { rows = result.transactions }
            else {
                let existing = Set(rows.map(\.id))
                rows += result.transactions.filter { !existing.contains($0.id) }
            }
            total = result.total; nextPage = result.nextPage
            store.transactionPages[requestedFilter] = TransactionPage(transactions: rows, total: total, nextPage: nextPage)
        } catch is CancellationError { }
        catch let failure as URLError where failure.code == .cancelled { }
        catch {
            guard requestID == identity, requestedFilter == filterKey else { return }
            self.error = error.localizedDescription
            if case APIError.expired = error { await store.signOut() }
        }
    }
}
struct TransactionRow: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let row: BankTransaction
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        HStack(spacing: 12) {
            MerchantBadge(row: row)
            VStack(alignment: .leading, spacing: 5) {
                Text(row.label).font(.system(size: 13, weight: .semibold)).foregroundStyle(.primary).lineLimit(2)
                Text(row.bank_name ?? (row.company.isEmpty ? row.category : row.company)).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 3)
            VStack(alignment: .trailing, spacing: 5) {
                Text((row.amount > 0 ? "+" : "") + row.amount.euros)
                    .font(.system(size: 13, weight: .semibold, design: .rounded)).monospacedDigit()
                    .foregroundStyle(row.amount >= 0 ? DP.tint(scheme) : (scheme == .dark ? .white : DP.ink))
                Text(row.scope == "pro" ? "PRO" : "PERSO").font(.system(size: 8, weight: .bold)).tracking(1).foregroundStyle(.tertiary)
            }
        }.padding(.vertical, 11).contentShape(Rectangle())
    }
}
struct TransactionDetail: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let row: BankTransaction
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        PageScroll {
            VStack(spacing: 15) {
                MerchantBadge(row: row)
                Text(row.label).font(.title3.weight(.semibold)).multilineTextAlignment(.center)
                Text(row.amount.euros).font(.system(size: 44, weight: .semibold, design: .rounded)).tracking(-1.5)
                Pill(text: row.scope == "pro" ? "Compte professionnel" : "Compte personnel", color: DP.tint(scheme))
            }.frame(maxWidth: .infinity).padding(.vertical, 24)
            DPCard {
                VStack(spacing: 15) {
                    LabeledContent("Date", value: dayLabel(row.date)); Divider()
                    LabeledContent("Catégorie", value: row.category)
                    if row.scope != "pro" {
                        Divider()
                        LabeledContent("Banque", value: row.bank_name ?? row.company)
                    }
                    if let balance = row.balance { Divider(); MoneyRow(title: "Solde après opération", amount: balance) }
                }.font(.subheadline)
            }
            if let vat = row.vat {
                DPCard {
                    VStack(alignment: .leading, spacing: 15) {
                        Text("Détail TVA").font(.headline)
                        MoneyRow(title: "Montant HT", amount: vat.ht)
                        Divider()
                        MoneyRow(title: (vat.kind == "recoverable" ? "TVA récupérable" : "TVA collectée") + " · " + vat.rate.formatted(.percent), amount: vat.amount)
                        Divider()
                        MoneyRow(title: "Montant TTC", amount: vat.ttc)
                        Text("Selon les règles de la catégorie dans DigitPro.").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        }.navigationTitle("Détail de l’opération").navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
    }
}
private struct MerchantBadge: View {
    let row: BankTransaction
    @Environment(\.colorScheme) private var scheme
    @State private var logo: UIImage?
    private var domain: String? { MerchantLogos.domain(for: row.label) }

    var body: some View {
        Group {
            if let logo {
                Image(uiImage: logo).resizable().scaledToFit().padding(7)
                    .frame(width: 44, height: 44)
                    .background(.white, in: RoundedRectangle(cornerRadius: 15))
                    .overlay { RoundedRectangle(cornerRadius: 15).stroke(DP.border(scheme), lineWidth: 1) }
            } else {
                SymbolBadge(symbol: transactionSymbol(row), color: row.amount >= 0 ? DP.tint(scheme) : DP.blue)
            }
        }.accessibilityHidden(true)
            .task(id: domain) {
                logo = nil
                guard let domain else { return }
                let loaded = await MerchantLogos.image(for: domain)
                guard !Task.isCancelled else { return }
                logo = loaded
            }
    }
}

@MainActor
private enum MerchantLogos {
    private static let cache = NSCache<NSString, UIImage>()
    // Identify the merchant from the label, never from the account's bank name.
    private static let brands: [(String, String)] = [
        ("mercedes", "mercedes-benz.com"), ("carrefour", "carrefour.com"), ("carref", "carrefour.com"),
        ("apple", "apple.com"), ("icloud", "apple.com"), ("amazon", "amazon.fr"), ("amzn", "amazon.fr"),
        ("openai", "openai.com"), ("chatgpt", "openai.com"), ("cursor", "cursor.com"),
        ("google", "google.com"), ("microsoft", "microsoft.com"), ("adobe", "adobe.com"),
        ("qonto", "qonto.com"), ("sncf", "sncf.com"), ("uber", "uber.com"),
        ("orange", "orange.fr"), ("sfr", "sfr.fr"), ("bouygues", "bouyguestelecom.fr"),
        ("netflix", "netflix.com"), ("spotify", "spotify.com"), ("totalenergies", "totalenergies.fr"),
        ("auchan", "auchan.fr"), ("leclerc", "e.leclerc"), ("lidl", "lidl.fr"),
        ("monoprix", "monoprix.fr"), ("intermarche", "intermarche.com"),
        ("ikea", "ikea.com"), ("fnac", "fnac.com"), ("darty", "darty.com"),
        ("decathlon", "decathlon.fr"), ("axa", "axa.fr"), ("urssaf", "urssaf.fr")
    ]
    static func domain(for label: String) -> String? {
        let words = label.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "fr_FR"))
            .lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }
        return brands.first { words.contains($0.0) }?.1
    }
    static func image(for domain: String) async -> UIImage? {
        if let image = cache.object(forKey: domain as NSString) { return image }
        // Same public favicon provider as the web. Only the mapped domain is sent.
        var components = URLComponents(string: "https://www.google.com/s2/favicons")!
        components.queryItems = [URLQueryItem(name: "domain", value: domain), URLQueryItem(name: "sz", value: "64")]
        guard let url = components.url else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let image = UIImage(data: data) else { return nil }
            cache.setObject(image, forKey: domain as NSString)
            return image
        } catch { return nil }
    }
}

private func transactionSymbol(_ row: BankTransaction) -> String {
    let text = (row.category + " " + row.label).lowercased()
    if text.contains("loyer") { return "house" }
    if text.contains("repas") || text.contains("restaurant") { return "fork.knife" }
    if text.contains("impôt") || text.contains("tva") || text.contains("urssaf") { return "building.columns" }
    if text.contains("transport") || text.contains("carburant") { return "car" }
    return row.amount >= 0 ? "arrow.down.left" : "arrow.up.right"
}
