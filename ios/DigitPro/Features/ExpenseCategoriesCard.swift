import SwiftUI
import Charts

struct ExpenseCategoriesCard: View {
    @EnvironmentObject private var store: AppStore
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let breakdown: ExpenseBreakdown
    let currentMonth: String
    var personalExpenses: Double? = nil
    var digitProExpenses: Double? = nil
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var period: String?
    @State private var showTtc = false
    @State private var expanded = false
    @State private var compactView = false
    @State private var angle: Double?
    @State private var detail: ExpenseCategory?
    private var month: String { period ?? currentMonth }
    private var availableMonths: [String] { breakdown.months.map(\.month) }
    private var annual: Bool { month.count == 4 }
    private var periodTitle: String { month == "all" ? "12 mois" : annual ? "Année " + month : monthLabel(month, abbreviated: false).capitalized }
    private var selectedRows: [ExpenseMonth] {
        month == "all" ? breakdown.months : (annual ? breakdown.years ?? [] : breakdown.months).filter { $0.month == month }
    }
    private var comparisonLabel: String { annual ? "vs année précédente" : "vs mois précédent" }
    private var categories: [ExpenseCategory] {
        let months = selectedRows
        var combined: [String: ExpenseCategory] = [:]
        for row in months {
            for category in row.categories {
                if var existing = combined[category.name] {
                    existing.amountHt += category.amountHt; existing.amountTtc += category.amountTtc
                    existing.count += category.count; combined[category.name] = existing
                } else { combined[category.name] = category }
            }
        }
        return combined.values.sorted {
            amount($0) == amount($1) ? $0.name < $1.name : amount($0) > amount($1)
        }
    }
    private var total: Double { categories.reduce(0) { $0 + amount($1) } }
    private var compactAllocation: (personal: Double, digitPro: Double)? {
        let rows = selectedRows
        let values = rows.compactMap { row -> (Double, Double)? in
            guard let personal = row.personalExpensesEur, let digitPro = row.digitProExpensesEur else { return nil }
            return (personal, digitPro)
        }
        guard !values.isEmpty else { return nil }
        return (values.reduce(0) { $0 + $1.0 }, values.reduce(0) { $0 + $1.1 })
    }
    private var selected: ExpenseCategory? {
        guard let angle else { return nil }
        var cursor: Double = 0
        return categories.first { category in cursor += amount(category); return angle < cursor }
    }
    private var previousTotal: Double? {
        guard let index = breakdown.months.firstIndex(where: { $0.month == month }), index > 0 else { return nil }
        let previous = breakdown.months[index - 1]
        return showTtc ? previous.totalTtc : previous.totalHt
    }
    private func amount(_ category: ExpenseCategory) -> Double { showTtc ? category.amountTtc : category.amountHt }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                SectionHeading(title: "Où va votre argent ?", subtitle: "Vos dépenses professionnelles, en détail")
                Spacer(minLength: 0)
            }
            DPCard {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(spacing: 10) {
                        Button { moveMonth(-1) } label: {
                            Image(systemName: "chevron.left").font(.caption.weight(.bold))
                                .frame(width: 34, height: 34).background(ExpensePalette.blue.opacity(0.09), in: Circle())
                        }.disabled(annual || month == "all" || month == availableMonths.first)
                        Menu {
                            Button("12 mois glissants") { period = "all" }
                            Divider()
                            ForEach((breakdown.years ?? []).reversed()) { row in
                                Button("Année " + row.month) { period = row.month }
                            }
                            Divider()
                            ForEach(breakdown.months.reversed()) { row in
                                Button(monthLabel(row.month, abbreviated: false).capitalized) { period = row.month }
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Text(periodTitle)
                                Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                            }.font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                                .frame(maxWidth: .infinity).padding(.vertical, 10)
                        }.accessibilityLabel("Période des dépenses").buttonStyle(.plain)
                        Button { moveMonth(1) } label: {
                            Image(systemName: "chevron.right").font(.caption.weight(.bold))
                                .frame(width: 34, height: 34).background(ExpensePalette.blue.opacity(0.09), in: Circle())
                        }.disabled(annual || month == "all" || month == availableMonths.last)
                    }
                    HStack {
                        Text("SORTIES").font(.system(size: 10, weight: .bold)).tracking(1.6).foregroundStyle(.secondary)
                        Spacer()
                        Picker("Montants", selection: $showTtc) { Text("HT").tag(false); Text("TTC").tag(true) }
                            .pickerStyle(.segmented).frame(width: 124)
                    }
                    if total > 0 || (compactView && compactAllocation != nil) {
                        if total > 0 { distribution.padding(.vertical, 4) }
                        HStack(alignment: .top) {
                            if let previousTotal, previousTotal > 0 {
                                let change = (total - previousTotal) / previousTotal
                                Pill(text: (change > 0 ? "+" : "") + change.formatted(.percent.precision(.fractionLength(0))) + " vs mois précédent",
                                     symbol: change > 0 ? "arrow.up.right" : "arrow.down.right", color: change > 0 ? ExpensePalette.sand : ExpensePalette.sage)
                            } else {
                                Pill(text: "\(categories.reduce(0) { $0 + $1.count }) opérations", symbol: "receipt", color: ExpensePalette.sage)
                            }
                            Spacer(minLength: 6)
                            Pill(text: "\(categories.count) catégories", symbol: "square.grid.2x2", color: ExpensePalette.blue)
                        }
                        Divider()
                        Picker("Présentation", selection: $compactView) {
                            Text("Catégories").tag(false)
                            Text("Vue compacte").tag(true)
                        }.pickerStyle(.segmented)
                        VStack(spacing: 0) {
                            if compactView, let allocation = compactAllocation {
                                ExpenseAllocationRow(title: "Dépenses personnelles", amount: allocation.personal, symbol: "person.fill", color: ExpensePalette.mauve, changePercent: month == "all" ? nil : selectedRows.first?.personalChangePercent, comparisonLabel: comparisonLabel)
                                Divider().padding(.leading, 54)
                                ExpenseAllocationRow(title: "Dépenses DigitPro", amount: allocation.digitPro, symbol: "briefcase.fill", color: ExpensePalette.blue, changePercent: month == "all" ? nil : selectedRows.first?.digitProChangePercent, comparisonLabel: comparisonLabel)
                            } else {
                                ForEach(compactView ? Array(categories.prefix(3)) : expanded ? categories : Array(categories.prefix(5))) { category in
                                    categoryRow(category)
                                    if category.id != (compactView ? categories.prefix(3).last?.id : (expanded ? categories.last?.id : categories.prefix(5).last?.id)) {
                                        Divider().padding(.leading, 54)
                                    }
                                }
                            }
                        }
                        if !compactView && categories.count > 5 {
                            Button {
                                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { expanded.toggle() }
                            } label: {
                                HStack { Text(expanded ? "Réduire la liste" : "Afficher toutes les catégories"); Spacer(); Image(systemName: expanded ? "chevron.up" : "chevron.down") }
                                    .font(.caption.weight(.semibold)).frame(minHeight: 38)
                            }
                        }
                    } else {
                        VStack(spacing: 12) {
                            Image(systemName: "tray").font(.system(size: 30, weight: .light)).foregroundStyle(.secondary)
                            Text("Aucune dépense sur cette période").font(.subheadline.weight(.medium))
                            Text("Choisissez un autre mois pour explorer vos catégories.").font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity).padding(.vertical, 25)
                    }
                    Text("Hors versements BNC et TVA · \(showTtc ? "montants TTC" : "règles HT du Dashboard web, repas TTC")")
                        .font(.system(size: 10)).foregroundStyle(.secondary)
                }
            }
        }
        .onChange(of: month) { _, _ in angle = nil; expanded = false }
        .onChange(of: showTtc) { _, _ in angle = nil }
        .onChange(of: total) { _, _ in angle = nil }
        .sheet(item: $detail) { category in
            ExpenseCategoryDetail(category: category, month: month, showTtc: showTtc,
                                  cached: store.cachedExpense(category: category.name, period: month))
                .presentationDragIndicator(.visible)
        }
    }
    private var distribution: some View {
        Chart(categories) { category in
            SectorMark(angle: .value("Dépenses", amount(category)), innerRadius: .ratio(0.80), angularInset: 1.0)
                .cornerRadius(3).foregroundStyle(category.tint)
                .opacity(selected == nil || selected?.id == category.id ? 1 : 0.48)
                .accessibilityLabel(category.name).accessibilityValue(amount(category).euros)
        }.chartAngleSelection(value: $angle)
            .frame(height: 210)
            .chartBackground { _ in
                VStack(spacing: 6) {
                    Text((selected.map(amount) ?? total).euros)
                        .font(.system(size: 25, weight: .semibold, design: .rounded)).tracking(-1)
                        .minimumScaleFactor(0.6).lineLimit(1).monospacedDigit()
                    Text(selected?.name ?? "Dépenses")
                        .font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).lineLimit(2)
                    Text(showTtc ? "TTC" : "HORS TAXES").font(.system(size: 8, weight: .semibold)).tracking(1.3).foregroundStyle(.tertiary)
                    if selected != nil {
                        Button("Réinitialiser") { angle = nil }.font(.system(size: 9, weight: .semibold))
                    }
                }.frame(maxWidth: 132)
            }
    }
    private func categoryRow(_ category: ExpenseCategory) -> some View {
        let share = total > 0 ? amount(category) / total : 0
        return Button { detail = category } label: {
            HStack(alignment: .center, spacing: 13) {
                Image(systemName: category.symbol).font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(category.tint).frame(width: 42, height: 42)
                    .background(category.tint.opacity(scheme == .dark ? 0.17 : 0.11), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text(category.name).font(.system(size: 14, weight: .semibold)).multilineTextAlignment(.leading)
                    Text("\(share.formatted(.percent.precision(.fractionLength(0)))) · \(category.count) transaction\(category.count > 1 ? "s" : "")")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 6)
                Text(amount(category).euros).font(.system(size: 15, weight: .semibold, design: .rounded)).monospacedDigit()
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(.tertiary)
            }.foregroundStyle(.primary).padding(.vertical, 13).contentShape(Rectangle())
        }.buttonStyle(.plain)
            .accessibilityLabel("\(category.name), \(amount(category).euros), \(category.count) opérations. Afficher le détail")
    }
    private func moveMonth(_ offset: Int) {
        guard month != "all", let index = availableMonths.firstIndex(of: month) else { return }
        let destination = index + offset
        guard availableMonths.indices.contains(destination) else { return }
        period = availableMonths[destination]
    }
}

private struct ExpenseAllocationRow: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let title: String
    let amount: Double
    let symbol: String
    let color: Color
    let changePercent: Double?
    let comparisonLabel: String
    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: symbol).font(.system(size: 16, weight: .semibold)).foregroundStyle(color)
                .frame(width: 42, height: 42).background(color.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 14, weight: .semibold))
                if let changePercent {
                    Text((changePercent > 0 ? "+" : "") + (changePercent / 100).formatted(.percent.precision(.fractionLength(1))) + " " + comparisonLabel)
                        .font(.caption).foregroundStyle(.secondary)
                } else {
                    Text("Répartition de la période").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 6)
            Text(amount.euros).font(.system(size: 15, weight: .semibold, design: .rounded)).monospacedDigit()
        }.padding(.vertical, 13)
    }
}

struct ExpenseCategoryDetail: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let category: ExpenseCategory
    let month: String
    let showTtc: Bool
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var rows: [ExpenseMovement] = []
    @State private var summary: ExpenseDetailPage?
    @State private var loading = false
    @State private var nextPage: Int?
    @State private var error: String?
    init(category: ExpenseCategory, month: String, showTtc: Bool, cached: ExpenseDetailPage? = nil) {
        self.category = category; self.month = month; self.showTtc = showTtc
        _summary = State(initialValue: cached)
        _rows = State(initialValue: cached?.transactions ?? [])
        _nextPage = State(initialValue: cached?.nextPage)
    }
    var body: some View {
        NavigationStack {
            PageScroll {
                DPCard {
                    VStack(spacing: 16) {
                        HStack {
                            Image(systemName: category.symbol).font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(category.tint).frame(width: 52, height: 52)
                                .background(category.tint.opacity(scheme == .dark ? 0.18 : 0.11), in: Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                Text(category.name).font(.title3.weight(.semibold))
                                Label(month == "all" ? "12 mois glissants" : month.count == 4 ? "Année " + month : monthLabel(month, abbreviated: false).capitalized,
                                      systemImage: "calendar")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        if let summary {
                            Divider()
                            HStack(alignment: .lastTextBaseline) {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text("TOTAL DES DÉPENSES").font(.system(size: 9, weight: .bold)).tracking(1.4).foregroundStyle(.secondary)
                                    Text(summary.totalTtc.euros)
                                        .font(.system(size: 34, weight: .semibold, design: .rounded)).tracking(-1.1).monospacedDigit()
                                }
                                Spacer()
                                Text("TTC").font(.caption.weight(.bold)).foregroundStyle(category.tint)
                            }
                            HStack {
                                Pill(text: "\(summary.total) transaction\(summary.total > 1 ? "s" : "")", symbol: "list.bullet", color: category.tint)
                                Spacer()

                            }
                            if let vat = summary.recoverableVat, vat > 0, let net = summary.taxNetTotal {
                                Divider()
                                HStack {
                                    recap("Montant HT", net)
                                    Spacer()
                                    recap("Montant TTC", summary.totalTtc)
                                    Spacer()
                                    recap("TVA récupérable", vat)
                                }
                            }
                        } else {
                            Divider()
                            VStack(alignment: .leading, spacing: 6) {
                                Text("TOTAL DES DÉPENSES · TTC").font(.caption2).foregroundStyle(.secondary)
                                Text(category.amountTtc.euros).font(.system(size: 34, weight: .semibold, design: .rounded)).monospacedDigit()
                                Text("\(category.count) transactions").font(.caption).foregroundStyle(.secondary)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                if let error { InlineError(message: error) { Task { await load(reset: summary == nil) } } }
                if !rows.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack { Eyebrow(text: "Transactions · TTC"); Spacer(); Text("Plus récentes d’abord").font(.caption2).foregroundStyle(.tertiary) }
                        DPCard {
                            LazyVStack(spacing: 0) {
                                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                                    HStack(spacing: 12) {
                                        Image(systemName: "arrow.down.left").font(.system(size: 12, weight: .bold))
                                            .foregroundStyle(category.tint).frame(width: 34, height: 34)
                                            .background(category.tint.opacity(scheme == .dark ? 0.15 : 0.09), in: Circle())
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(row.label).font(.subheadline.weight(.medium)).lineLimit(2)
                                            HStack(spacing: 5) {
                                                Text(dayLabel(row.date)); Text("·"); Text(row.bankName).lineLimit(1)
                                            }.font(.caption2).foregroundStyle(.secondary)
                                        }
                                        Spacer(minLength: 6)
                                        VStack(alignment: .trailing, spacing: 4) {
                                            Text(row.amountTtc.euros)
                                                .font(.system(.subheadline, design: .rounded, weight: .semibold)).monospacedDigit()
                                        }
                                    }.padding(.vertical, 13)
                                    if index < rows.count - 1 { Divider().padding(.leading, 46) }
                                }
                            }
                        }
                    }
                }
                if loading { ProgressView().frame(maxWidth: .infinity).padding() }
                else if nextPage != nil { Button("Charger la suite") { Task { await load(reset: false) } }.buttonStyle(PrimaryButtonStyle()) }
                else if summary != nil && rows.isEmpty { ContentUnavailableView("Aucune opération", systemImage: "tray", description: Text("Les données ont peut-être changé. Actualisez le Dashboard.")) }
            }.navigationTitle("Détail").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fermer") { dismiss() } } }
                .task { if summary == nil { await load(reset: true) } }
        }
    }
    private func recap(_ title: String, _ amount: Double) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.system(size: 10)).foregroundStyle(.secondary)
            Text(amount.euros).font(.system(size: 13, weight: .semibold, design: .rounded)).monospacedDigit().minimumScaleFactor(0.7).lineLimit(1)
        }
    }
    private func load(reset: Bool) async {
        guard let api = store.api, !loading else { return }
        let revision = store.expenseRevision
        loading = true; error = nil
        defer { loading = false }
        do {
            let result: ExpenseDetailPage = try await api.get("expenses", query: [
                URLQueryItem(name: "category", value: category.name), URLQueryItem(name: "month", value: month),
                URLQueryItem(name: "page", value: String(reset ? 0 : (nextPage ?? 0)))
            ])
            try Task.checkCancellation()
            guard store.signedIn else { return }
            if store.expenseRevision != revision {
                loading = false
                await load(reset: true)
                return
            }
            if reset { store.cacheExpense(result, revision: revision) }
            if reset { rows = [] }
            let existing = Set(rows.map(\.id))
            rows += result.transactions.filter { !existing.contains($0.id) }
            summary = result; nextPage = result.nextPage
        } catch is CancellationError { }
        catch let failure as URLError where failure.code == .cancelled { }
        catch {
            self.error = error.localizedDescription
            if case APIError.expired = error { dismiss(); await store.signOut() }
        }
    }
}
private enum ExpensePalette {
    // Palette lumineuse sur le fond pétrole du Dashboard, alignée avec le web.
    static let blue = Color(hex: 0x60A5FA)
    static let sage = Color(hex: 0x6EE7B7)
    static let mauve = Color(hex: 0xC4B5FD)
    static let sand = Color(hex: 0xFCD34D)
    static let coral = Color(hex: 0xFDA4AF)
    static let slate = Color(hex: 0x94A3B8)
    static let mist = Color(hex: 0x67E8F9)
}
private extension ExpenseCategory {
    var tint: Color {
        switch name {
        case "Compta & admin.", "Qonto": ExpensePalette.blue
        case "NDF", "Indemnités kilométriques", "ANCV": ExpensePalette.sage
        case "Repas d'affaire", "Repas dirigeant", "Cadeau client": ExpensePalette.sand
        case "iCloud IA Store", "Mobile et Internet", "Matériel": ExpensePalette.mist
        case "Assurance", "Mutuelle", "Retraite": ExpensePalette.mauve
        case "Urssaf", "Impôt": ExpensePalette.coral
        default: ExpensePalette.slate
        }
    }
    var symbol: String {
        switch name {
        case "Compta & admin.": "doc.text"
        case "NDF": "receipt"
        case "Indemnités kilométriques": "car"
        case "Repas d'affaire", "Repas dirigeant": "fork.knife"
        case "iCloud IA Store": "cloud"
        case "Mobile et Internet": "wifi"
        case "Qonto": "building.columns"
        case "Assurance": "shield.lefthalf.filled"
        case "Mutuelle": "heart"
        case "Matériel": "laptopcomputer"
        case "Urssaf", "Impôt": "building.columns"
        case "CESU": "house"
        case "ANCV": "sun.max"
        case "Cadeau client": "gift"
        case "Retraite": "leaf"
        default: "square.grid.2x2"
        }
    }
}
