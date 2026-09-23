import SwiftUI
import Charts

struct DashboardView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var selectedMonth: String?
    private var mint: Color { DP.tint(scheme) }
    private var chartColor: Color { scheme == .dark ? .white : DP.tint(scheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                dashboardTopBar
                if let data = store.overview {
                    if let error = store.overviewError { InlineError(message: error) { Task { await store.refresh() } } }
                    cashHero(data)
                    actionRow
                    treasuryAccount(data)
                    activitySummary(data)
                    if let expenses = data.expenses {
                        ExpenseCategoriesCard(breakdown: expenses, currentMonth: data.month,
                                              personalExpenses: data.widget?.personalExpensesEur,
                                              digitProExpenses: data.widget?.digitProExpensesEur)
                    }
                    Text("\(data.transactionCount.formatted()) opérations · Actualisé le \(displayTimestamp(data.generatedAt))")
                        .font(.system(size: 10)).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                } else { LoadingOverview() }
            }
            .frame(maxWidth: 720).padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 32)
            .frame(maxWidth: .infinity)
        }
        .background { dashboardBackground }
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await store.refresh() }
    }

    private var dashboardBackground: some View { PageBackground() }

    private var dashboardTopBar: some View {
        HStack(spacing: 12) {
            Button { store.selectedTab = .settings } label: { BrandMark(size: 48).background(mint, in: Circle()) }
                .accessibilityLabel("Ouvrir mon compte")
            Spacer(minLength: 0)
            Button { store.selectedTab = .activity } label: {
                Image(systemName: "chart.bar.fill").font(.system(size: 19, weight: .semibold))
                    .frame(width: 48, height: 48).background(DP.surface(scheme), in: Circle())
                    .overlay(Circle().stroke(DP.border(scheme)))
            }.accessibilityLabel("Afficher l’activité")
        }.foregroundStyle(.primary)
    }

    private func cashHero(_ data: Overview) -> some View {
        let rows = data.activityMonths
        let selected = rows.first { $0.month == selectedMonth } ?? rows.last
        return VStack(spacing: 17) {
            VStack(spacing: 7) {
                Text(selectedMonth == nil ? "Trésorerie disponible" : monthLabel(selected?.month ?? data.month, abbreviated: false).capitalized)
                    .font(.system(size: 16, weight: .medium)).foregroundStyle(.secondary)
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    Text(selectedMonth == nil ? (data.dashboard.soldeQontoEur?.euros ?? "—") : (selected?.revenueHtEur ?? 0).euros)
                        .font(.system(size: 48, weight: .semibold, design: .rounded)).tracking(-2)
                        .monospacedDigit().minimumScaleFactor(0.48).lineLimit(1)
                    if selectedMonth != nil { Text("HT").font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                }
                if selectedMonth == nil, let comparison = data.balanceComparison {
                    HStack(spacing: 9) {
                        Text((comparison.deltaEur >= 0 ? "+" : "") + comparison.deltaEur.euros)
                        if let percent = comparison.percent {
                            Text((percent / 100).formatted(.percent.precision(.fractionLength(0))))
                        }
                    }.font(.system(size: 14, weight: .medium)).foregroundStyle(comparison.deltaEur >= 0 ? mint : DP.rose)
                    Text("Solde · vs fin du mois dernier").font(.caption2).foregroundStyle(.secondary)
                }
            }.padding(.top, 0)
            HStack {
                Text("CA généré HT · depuis janvier").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text(data.generatedRevenueHtEur?.euros ?? "—").font(.subheadline.weight(.semibold)).monospacedDigit()
            }

            if let upcoming = data.upcomingInvoice {
                VStack(spacing: 3) {
                    HStack(spacing: 6) {
                        Text("À encaisser").foregroundStyle(.secondary)
                        Spacer(minLength: 4)
                        Text(upcoming.amountTtcEur.euros + " TTC").fontWeight(.semibold).monospacedDigit()
                        Text("· " + upcoming.statusLabel).foregroundStyle(.secondary)
                    }.font(.caption).lineLimit(1).minimumScaleFactor(0.75)
                    Text(upcoming.amountHtEur.euros + " HT").font(.system(size: 10)).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }.padding(.vertical, 2)
            }
            Text("CA encaissé par mois · HT").font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            Chart(rows) { month in
                AreaMark(x: .value("Mois", month.month), y: .value("CA", month.revenueHtEur))
                    .foregroundStyle(LinearGradient(colors: [chartColor.opacity(0.20), .clear], startPoint: .top, endPoint: .bottom))
                    .interpolationMethod(.catmullRom)
                LineMark(x: .value("Mois", month.month), y: .value("CA", month.revenueHtEur))
                    .foregroundStyle(chartColor).lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.catmullRom)
                if selectedMonth == month.month {
                    RuleMark(x: .value("Mois", month.month)).foregroundStyle(chartColor.opacity(0.3))
                    PointMark(x: .value("Mois", month.month), y: .value("CA", month.revenueHtEur)).foregroundStyle(mint).symbolSize(72)
                }
            }
            .chartXSelection(value: $selectedMonth).chartXAxis(.hidden).chartYAxis(.hidden).frame(height: 170)
            .accessibilityLabel("Évolution du chiffre d’affaires. Touchez la courbe pour afficher un mois.")
            HStack(spacing: 0) {
                ForEach(rows) { month in
                    Text(monthLabel(month.month))
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Color.primary.opacity(selectedMonth == month.month ? 0.95 : 0.55))
                        .frame(maxWidth: .infinity)
                }
            }
            if let selected, selectedMonth != nil {
                HStack(spacing: 0) {
                    HeroDetail(label: "Montant", value: selected.revenueHtEur.euros); HeroDivider()
                    HeroDetail(label: "TJM", value: (selected.tjmHtEur ?? 0).euros); HeroDivider()
                    HeroDetail(label: "Jours", value: String(selected.workedDays ?? 0))
                }.padding(.horizontal, 12).padding(.vertical, 10)
                    .background(DP.surface(scheme), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private var actionRow: some View {
        HStack(alignment: .top, spacing: 8) {
            heroAction("Activité", symbol: "chart.line.uptrend.xyaxis", tab: .activity)
            heroAction("Opérations", symbol: "plus", tab: .transactions)
            heroAction("Prévisionnel", symbol: "arrow.down", tab: .forecast)
            heroAction("Plus", symbol: "ellipsis", tab: .finance)
        }
    }

    private func heroAction(_ title: String, symbol: String, tab: AppTab) -> some View {
        Button { store.selectedTab = tab } label: {
            VStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 20, weight: .bold)).frame(width: 56, height: 56)
                    .background(mint.opacity(0.10), in: Circle())
                Text(title).font(.system(size: 11, weight: .semibold)).lineLimit(2).multilineTextAlignment(.center)
            }.frame(maxWidth: .infinity)
        }.buttonStyle(.plain).foregroundStyle(.primary)
    }

    private func treasuryAccount(_ data: Overview) -> some View {
        let cash = data.dashboard.soldeQontoEur ?? 0
        let remuneration = cash - data.dashboard.detteTotaleDepuisDebutEur
        let csgTarget = data.dashboard.csgComparaison172Eur + data.dashboard.detteTvaDepuisDebutEur
        let csgRemaining = max(0, csgTarget - cash)
        return VStack(spacing: 0) {
            AccountGauge(title: remuneration >= 0 ? "Rémunération à verser" : "Dette nette", subtitle: "Après CSG et TVA",
                         amount: abs(remuneration), progress: cash > 0 ? max(0, remuneration) / cash : 0,
                         symbol: "eurosign.circle.fill", color: mint)
            Divider().padding(.leading, 58)
            AccountGauge(title: "Reste à couvrir · CSG 17,2 %", subtitle: "TVA comprise", amount: csgRemaining,
                         progress: csgTarget > 0 ? min(1, cash / csgTarget) : 1,
                         symbol: "shield.lefthalf.filled", color: Color(hex: 0x74BBD0))
        }.padding(8).background(DP.surface(scheme), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(DP.border(scheme)))
    }

    private func activitySummary(_ data: Overview) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Votre activité").font(.title3.weight(.semibold))
            HStack(spacing: 12) {
                DPMetricTile(title: "CA du mois", value: data.dashboard.caMensuelEur.euros, symbol: "arrow.up.right", color: mint)
                DPMetricTile(title: "Dépenses", value: data.dashboard.depensesQontoSasuMoisEur.euros, symbol: "arrow.down.right", color: Color(hex: 0xD2A873))
            }
        }
    }
}

private struct HeroDetail: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let label: String; let value: String
    var body: some View {
        VStack(spacing: 3) {
            Text(label.uppercased()).font(.system(size: 8, weight: .bold)).tracking(1).foregroundStyle(.secondary)
            Text(value).font(.system(.subheadline, design: .rounded, weight: .semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
        }.frame(maxWidth: .infinity)
    }
}
private struct HeroDivider: View { var body: some View { Divider().frame(height: 30) } }

private struct AccountGauge: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let title: String; let subtitle: String; let amount: Double; let progress: Double; let symbol: String; let color: Color
    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: symbol).font(.system(size: 16, weight: .semibold)).foregroundStyle(color)
                .frame(width: 42, height: 42).background(color.opacity(0.10), in: Circle())
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
                        Text(subtitle).font(.system(size: 10)).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 8)
                    Text(amount.euros).font(.system(.subheadline, design: .rounded, weight: .semibold)).monospacedDigit()
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.primary.opacity(0.08))
                        Capsule().fill(color).frame(width: proxy.size.width * min(max(progress, 0), 1))
                    }
                }.frame(height: 5)
            }
        }.padding(14)
    }
}

func displayTimestamp(_ string: String) -> String {
    let parser = ISO8601DateFormatter(); parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return parser.date(from: string)?.formatted(date: .abbreviated, time: .shortened) ?? string
}
