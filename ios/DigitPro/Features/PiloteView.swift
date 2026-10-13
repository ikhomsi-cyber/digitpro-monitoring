import SwiftUI

struct PiloteView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var data: PiloteResponse?
    @State private var failure: String?
    @State private var loading = false
    @State private var requestID = UUID()
    @State private var period = ""
    @State private var annual = false
    @State private var views: Set<String> = ["essential"]
    @State private var travelScope = "year"
    @State private var travelYear: String = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Paris")!
        return String(calendar.component(.year, from: Date()))
    }()
    @State private var imports = false
    private var queryKey: String { [period, views.sorted().joined(separator: ","), travelScope, travelYear].joined(separator: "|") }
    var body: some View {
        PageScroll {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Pilote").font(.system(.largeTitle, design: .rounded, weight: .semibold)).tracking(-1)
                    Text("Votre bilan, une vision claire.").font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Button { imports = true } label: { Image(systemName: "square.and.arrow.down").frame(width: 44, height: 44).background(DP.surface(scheme), in: Circle()) }
                    .accessibilityLabel("Importer les données Bankin")
            }
            if let failure { InlineError(message: failure) { Task { await load() } } }
            if loading && data != nil { ProgressView().frame(maxWidth: .infinity) }
            if loading && data == nil { ProgressView("Chargement de Pilote…").frame(maxWidth: .infinity).padding(40) }
            if let data {
                if let summary = data.summary {
                    PiloteCoverage(summary: summary)
                    periodControls(data)
                    viewControls
                    PiloteBars(title: "Rentrées", amount: summary.income, families: data.families, income: true)
                    PiloteBars(title: "Sorties", amount: summary.expenses, families: data.families, income: false)
                    DPCard { VStack(alignment: .leading, spacing: 9) {
                        Eyebrow(text: "Rentrées − dépenses de cette vue")
                        Text(summary.balance.euros).font(.system(size: 30, weight: .semibold, design: .rounded)).foregroundStyle(summary.balance < 0 ? DP.rose : DP.tint(scheme))
                        Text("Les rentrées sont communes aux vues.").font(.caption2).foregroundStyle(.secondary)
                    } }
                    DPCard { VStack(alignment: .leading, spacing: 5) {
                        SectionHeading(title: "Compensation par famille")
                        ForEach(data.families) { family in
                            PiloteFamilyRow(family: family)
                            if family.id != data.families.last?.id { Divider() }
                        }
                    } }
                    DPCard { DisclosureGroup {
                        ForEach(data.categories) { category in
                            DisclosureGroup {
                                ForEach(category.children) { sub in MoneyRow(title: sub.name, amount: sub.expenses) }
                            } label: { MoneyRow(title: category.name, amount: category.expenses) }.padding(.vertical, 6)
                        }
                    } label: { SectionHeading(title: "Où part votre argent ?") } }
                    DPCard { VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Les rentrées qui compensent")
                        ForEach(data.incomeCategories) { group in MoneyRow(title: group.name, amount: group.income, color: DP.tint(scheme)) }
                    } }
                } else {
                    ContentUnavailableView("Votre bilan vous attend", systemImage: "tray", description: Text("Importez votre export Bankin pour retrouver vos analyses."))
                    Button("Importer Bankin") { imports = true }.buttonStyle(PrimaryButtonStyle())
                }
                PiloteTravelCard(travel: data.travel, scope: $travelScope, year: $travelYear)
            }
        }
        .navigationTitle("Pilote").navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .privacySensitive()
        .task(id: queryKey) { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $imports) { PiloteImportSheet() }
    }
    private func periodControls(_ data: PiloteResponse) -> some View {
        VStack(spacing: 14) {
            Picker("Période", selection: $annual) { Text("Mois").tag(false); Text("Année entière").tag(true) }.pickerStyle(.segmented)
                .onChange(of: annual) { _, value in
                    if value { period = (data.period ?? data.months.last ?? "").prefix(4).description }
                    else { period = data.months.last(where: { $0.hasPrefix(period.prefix(4).description) }) ?? data.months.last ?? "" }
                }
            HStack {
                Button { shift(data, -1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.disabled(!canShift(data, -1)).accessibilityLabel("Période précédente")
                Spacer()
                Menu {
                    ForEach(annual ? data.years : Array(data.months.reversed()), id: \.self) { value in Button(annual ? value : monthLabel(value, abbreviated: false).capitalized) { period = value } }
                } label: { Text(annual ? (data.period ?? "") : monthLabel(data.period ?? "", abbreviated: false).capitalized).font(.subheadline.weight(.semibold)) }
                Spacer()
                Button { shift(data, 1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }.disabled(!canShift(data, 1)).accessibilityLabel("Période suivante")
            }
        }
    }
    private var viewControls: some View {
        HStack(spacing: 6) {
            ForEach([("essential", "Essentiel"), ("secondary", "Presque essentiel"), ("travel", "Voyages")], id: \.0) { value, label in
                Button { if views.contains(value) { views.remove(value) } else { views.insert(value) } } label: {
                    Text(label).font(.system(size: 11, weight: .semibold)).frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(views.contains(value) ? DP.tint(scheme).opacity(0.2) : DP.surface(scheme).opacity(0.6), in: Capsule())
                        .overlay(Capsule().stroke(views.contains(value) ? DP.tint(scheme).opacity(0.5) : DP.border(scheme)))
                }.buttonStyle(.plain).accessibilityAddTraits(views.contains(value) ? .isSelected : [])
            }
        }
    }
    private func canShift(_ data: PiloteResponse, _ direction: Int) -> Bool {
        let choices = annual ? data.years.sorted() : data.months
        guard let index = choices.firstIndex(of: data.period ?? "") else { return false }
        return choices.indices.contains(index + direction)
    }
    private func shift(_ data: PiloteResponse, _ direction: Int) {
        let choices = annual ? data.years.sorted() : data.months
        if let index = choices.firstIndex(of: data.period ?? ""), choices.indices.contains(index + direction) { period = choices[index + direction] }
    }
    @MainActor private func load() async {
        guard let api = store.api, store.signedIn, !store.locked else { return }
        let owner = api.supabase.auth.currentSession?.user.id
        let identity = UUID(); requestID = identity; loading = true; failure = nil
        let key = queryKey
        defer { if requestID == identity { loading = false } }
        var query = [URLQueryItem(name: "views", value: views.sorted().joined(separator: ",")), URLQueryItem(name: "travelScope", value: travelScope), URLQueryItem(name: "travelYear", value: travelYear)]
        if !period.isEmpty { query.append(URLQueryItem(name: "period", value: period)) }
        do {
            let result: PiloteResponse = try await api.get("pilote", query: query)
            guard requestID == identity, key == queryKey, store.signedIn, !store.locked, owner == api.supabase.auth.currentSession?.user.id else { return }
            guard result.version == 1 else { throw APIError.invalidResponse }
            data = result
        } catch is CancellationError { }
        catch let error as URLError where error.code == .cancelled { }
        catch {
            guard requestID == identity else { return }
            failure = error.localizedDescription
            if case APIError.expired = error { await store.signOut() }
        }
    }
}

private struct PiloteImportSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            PageScroll {
                SectionHeading(title: "Vos imports Bankin", subtitle: "Retrouvez les mêmes données sur tous vos appareils.")
                DPCard { VStack(alignment: .leading, spacing: 16) {
                    Text("Gmail et Excel").font(.headline)
                    Text("L’import s’ouvre dans votre espace web sécurisé. Revenez ensuite dans Pilote et actualisez le bilan.").font(.subheadline).foregroundStyle(.secondary)
                    if let url = store.api?.piloteImportURL { Link(destination: url) { Label("Ouvrir les imports", systemImage: "arrow.up.right.square").frame(maxWidth: .infinity) }.buttonStyle(PrimaryButtonStyle()) }
                } }
            }.navigationTitle("Importer").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fermer") { dismiss() } } }
        }
    }
}
private struct PiloteCoverage: View {
    @Environment(\.colorScheme) private var scheme
    let summary: PiloteSummary
    var body: some View {
        HStack(spacing: 22) {
            ZStack {
                Circle().stroke(.secondary.opacity(0.12), lineWidth: 9)
                Circle().trim(from: 0, to: min(1, max(0, Double(summary.coveragePercent)/100))).stroke(DP.tint(scheme).gradient, style: StrokeStyle(lineWidth: 9, lineCap: .round)).rotationEffect(.degrees(-90))
                VStack(spacing: 3) { Text("\(summary.coveragePercent) %").font(.title3.weight(.semibold)).monospacedDigit(); Text("couverture").font(.system(size: 9)).foregroundStyle(.secondary) }
            }.frame(width: 96, height: 96)
            VStack(alignment: .leading, spacing: 8) {
                Text(summary.balance < 0 ? "Solde négatif" : "Solde positif").font(.headline).foregroundStyle(summary.balance < 0 ? DP.rose : DP.tint(scheme))
                Text("\(summary.income.euros) de rentrées\npour \(summary.expenses.euros) de sorties.").font(.caption).foregroundStyle(.secondary).lineSpacing(4)
            }
        }.padding(.vertical, 10).accessibilityElement(children: .combine)
    }
}
private func piloteColor(_ id: String) -> Color {
    switch id { case "rent": DP.accent; case "transport": DP.blue; case "ndf": Color(hex: 0xA78BFA); case "food": DP.amber; default: DP.rose }
}
private func piloteEmoji(_ id: String) -> String {
    switch id { case "rent": "🏠"; case "transport": "🚗"; case "ndf": "🧾"; case "food": "🍽️"; default: "💳" }
}
private struct PiloteBars: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let amount: Double
    let families: [PiloteFamily]
    let income: Bool
    var body: some View {
        DPCard { VStack(alignment: .leading, spacing: 16) {
            Eyebrow(text: title)
            Text(amount.euros).font(.system(size: 30, weight: .semibold, design: .rounded)).foregroundStyle(income ? DP.tint(scheme) : DP.amber)
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(families) { family in
                    let value = income ? family.income : family.expenses
                    let maximum = max(1, families.map { income ? $0.income : $0.expenses }.max() ?? 1)
                    VStack(spacing: 8) {
                        VStack(spacing: 6) {
                            Text(value.euros).font(.system(size: 9, weight: .semibold)).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1)
                            UnevenRoundedRectangle(topLeadingRadius: 12, topTrailingRadius: 12).fill(LinearGradient(colors: [piloteColor(family.id).opacity(0.85), piloteColor(family.id).opacity(0.08)], startPoint: .top, endPoint: .bottom)).frame(width: 17, height: max(value > 0 ? 3 : 0, value/maximum*100))
                        }.frame(height: 120, alignment: .bottom)
                        Rectangle().fill(.secondary.opacity(0.12)).frame(height: 1)
                        Text(piloteEmoji(family.id)).font(.body).frame(width: 32, height: 32).background(.secondary.opacity(0.08), in: Circle())
                        Text(income ? family.source : family.name).font(.system(size: 9)).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(height: 30, alignment: .top)
                    }.frame(maxWidth: .infinity).accessibilityElement(children: .ignore).accessibilityLabel(income ? family.source : family.name).accessibilityValue(value.euros)
                }
            }
        } }
    }
}
private struct PiloteFamilyRow: View {
    @Environment(\.colorScheme) private var scheme
    let family: PiloteFamily
    @State private var expanded = false
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() } } label: {
                HStack {
                    Circle().fill(piloteColor(family.id)).frame(width: 5, height: 5)
                    VStack(alignment: .leading, spacing: 3) { Text(family.name).font(.subheadline.weight(.semibold)); Text(family.source).font(.caption2).foregroundStyle(.secondary) }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.secondary).rotationEffect(.degrees(expanded ? 90 : 0))
                }.foregroundStyle(.primary).padding(.vertical, 3)
            }.buttonStyle(.plain).accessibilityLabel("\(family.name), \(expanded ? "réduire" : "voir") le détail")
            HStack(alignment: .top) {
                metric("Dépensé", family.expenses, .primary)
                Spacer()
                metric("Reçu", family.income, DP.tint(scheme))
                Spacer()
                metric(family.balance < 0 ? "À couvrir" : "Disponible", abs(family.balance), family.balance < 0 ? DP.rose : DP.tint(scheme))
            }
            if family.moroccoIncome > 0 { Text("\((family.income-family.moroccoIncome).euros) Bankin + \(family.moroccoIncome.euros) Maroc").font(.caption2).foregroundStyle(.secondary) }
            GeometryReader { proxy in
                let scale = max(family.income, family.expenses, 1)
                ZStack(alignment: .leading) {
                    Capsule().fill(.secondary.opacity(0.16))
                    HStack(spacing: 0) {
                        Rectangle().fill(DP.tint(scheme)).frame(width: proxy.size.width*min(family.income, family.expenses)/scale)
                        Rectangle().fill(DP.rose).frame(width: proxy.size.width*max(0, family.expenses-family.income)/scale)
                    }.clipShape(Capsule())
                    if family.expenses > family.income && family.income > 0 { Rectangle().fill(.primary).frame(width: 1, height: 8).offset(x: proxy.size.width*family.income/scale) }
                }
            }.frame(height: 4).accessibilityLabel("\(family.covered.euros) compensés sur \(family.expenses.euros)")
            if family.moroccoIncome > 0 {
                HStack(alignment: .top) {
                    scenario("Sans loyer Maroc", family.withoutMoroccoBalance, family.income-family.moroccoIncome)
                    Spacer()
                    scenario("Avec loyer Maroc", family.balance, family.income)
                }
            }
            if expanded {
                Divider()
                details("Dépenses", family.expenseRows)
                details("Rentrées", family.incomeRows)
            }
        }.padding(.vertical, 12)
    }
    private func metric(_ title: String, _ amount: Double, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) { Text(title).font(.system(size: 10)).foregroundStyle(.secondary); Text(amount.euros).font(.system(.subheadline, design: .rounded, weight: .semibold)).foregroundStyle(color).monospacedDigit().minimumScaleFactor(0.65).lineLimit(1) }
    }
    private func scenario(_ title: String, _ balance: Double, _ income: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.system(size: 10)).foregroundStyle(.secondary)
            Text("\(abs(balance).euros) \(balance < 0 ? "à couvrir" : "disponibles")").font(.caption.weight(.semibold)).foregroundStyle(balance < 0 ? DP.rose : DP.tint(scheme))
            Text("\(family.expenses.euros) − \(income.euros)").font(.system(size: 9)).foregroundStyle(.secondary)
        }
    }
    private func details(_ title: String, _ rows: [PiloteDetail]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(text: title)
            ForEach(rows) { row in VStack(alignment: .leading, spacing: 2) { MoneyRow(title: row.name, amount: row.amount); if let parent = row.parent { Text(parent).font(.system(size: 9)).foregroundStyle(.secondary) } } }
            if rows.isEmpty { Text("Aucun mouvement.").font(.caption).foregroundStyle(.secondary) }
        }.padding(.top, 4)
    }
}
