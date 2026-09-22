import SwiftUI
import WidgetKit

struct BalanceEntry: TimelineEntry { let date: Date; let snapshot: WidgetSnapshot? }
struct BalanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> BalanceEntry { BalanceEntry(date: .now, snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (BalanceEntry) -> Void) {
        completion(BalanceEntry(date: .now, snapshot: context.isPreview ? nil : WidgetCache.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<BalanceEntry>) -> Void) {
        let snapshot = WidgetCache.read()
        let expiry = snapshot?.updatedAt.addingTimeInterval(86400) ?? Date().addingTimeInterval(3600)
        var entries = [BalanceEntry(date: .now, snapshot: snapshot)]
        if let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: .now)), midnight < expiry {
            entries.append(BalanceEntry(date: midnight, snapshot: snapshot))
        }
        entries.append(BalanceEntry(date: expiry, snapshot: nil))
        completion(Timeline(entries: entries, policy: .after(expiry)))
    }
}

private enum WidgetTone {
    static let emerald = Color(red: 0.48, green: 0.78, blue: 0.67)
    static let blue = Color(red: 0.51, green: 0.66, blue: 0.78)
    static let mauve = Color(red: 0.67, green: 0.60, blue: 0.72)
    static let panel = Color.white.opacity(0.075)
    static let secondary = Color.white.opacity(0.62)
}

struct DigitProWidgetView: View {
    let entry: BalanceEntry
    @Environment(\.widgetFamily) private var family
    var body: some View {
        Group {
            if let snapshot = entry.snapshot, snapshot.revenueTtcEur != nil {
                if family == .systemSmall { small(snapshot) } else { medium(snapshot) }
            } else { emptyState }
        }
        .padding(12)
        .foregroundStyle(.white)
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(red: 0.07, green: 0.23, blue: 0.27), Color(red: 0.025, green: 0.105, blue: 0.125)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
    private func medium(_ value: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            header(value)
            HStack(spacing: 9) {
                VStack(alignment: .leading, spacing: 3) {
                    Label("ENTRÉES DU MOIS", systemImage: "arrow.down.left")
                        .font(.system(size: 8, weight: .bold)).tracking(0.7).foregroundStyle(WidgetTone.emerald)
                    Text(widgetEuro(value.revenueTtcEur)).font(.system(size: 21, weight: .semibold, design: .rounded)).minimumScaleFactor(0.65).lineLimit(1)
                    Text("\(widgetEuro(value.revenueHtEur)) HT · TTC encaissé")
                        .font(.system(size: 9, weight: .medium)).foregroundStyle(WidgetTone.secondary).lineLimit(1)
                }.frame(maxWidth: .infinity, alignment: .leading)
                    .padding(6).background(WidgetTone.panel, in: RoundedRectangle(cornerRadius: 15))
                VStack(spacing: 7) {
                    compactMetric("Jours", value: "\(value.workedDays ?? 0) j", symbol: "calendar.badge.checkmark", color: WidgetTone.blue)
                    compactMetric("CA sécurisé", value: widgetEuro(value.securedRevenueHtEur), symbol: "checkmark.shield", color: WidgetTone.emerald)
                }.frame(maxWidth: .infinity)
            }
            receivable(value)
            HStack(spacing: 9) {
                expenseMetric("DigitPro", value: value.digitProExpensesEur, change: value.digitProExpensesChangePercent, symbol: "building.2", color: WidgetTone.blue)
                expenseMetric("Personnel", value: value.personalExpensesEur, change: value.personalExpensesChangePercent, symbol: "person", color: WidgetTone.mauve)
            }
        }.privacySensitive()
    }
    private func small(_ value: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            header(value)
            VStack(alignment: .leading, spacing: 2) {
                Text(widgetEuro(value.revenueTtcEur)).font(.system(size: 20, weight: .semibold, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1)
                Text("\(widgetEuro(value.revenueHtEur)) HT · entrées").font(.system(size: 9, weight: .medium)).foregroundStyle(WidgetTone.emerald)
            }
            Text("À encaisser : " + widgetEuro(value.outstandingInvoiceHtEur.map { ($0 * 120).rounded() / 100 }) + " TTC").font(.system(size: 9, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.6)
            if let days = paymentDays(value) { Text(paymentDelay(days)).font(.system(size: 8)).foregroundStyle(WidgetTone.secondary) }
            HStack { tinyMetric("Jours", "\(value.workedDays ?? 0) j"); Spacer(); tinyMetric("CA sûr", widgetEuro(value.securedRevenueHtEur)) }
            HStack { tinyMetric("DigitPro · " + widgetChange(value.digitProExpensesChangePercent), widgetEuro(value.digitProExpensesEur)); Spacer(); tinyMetric("Perso · " + widgetChange(value.personalExpensesChangePercent), widgetEuro(value.personalExpensesEur)) }
        }.privacySensitive()
    }
    private func paymentDays(_ value: WidgetSnapshot) -> Int? {
        guard let days = value.nextPaymentDays else { return nil }
        let calendar = Calendar.current
        let elapsed = calendar.dateComponents([.day], from: calendar.startOfDay(for: value.updatedAt), to: calendar.startOfDay(for: entry.date)).day ?? 0
        return days - max(0, elapsed)
    }
    private func receivable(_ value: WidgetSnapshot) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "clock").foregroundStyle(WidgetTone.emerald)
            Text("À encaisser").foregroundStyle(WidgetTone.secondary)
            Text(widgetEuro(value.outstandingInvoiceHtEur.map { ($0 * 120).rounded() / 100 }) + " TTC").fontWeight(.semibold)
            Spacer(minLength: 0)
            if let days = paymentDays(value) { Text(paymentDelay(days)).foregroundStyle(WidgetTone.secondary) }
        }.font(.system(size: 10)).lineLimit(1).minimumScaleFactor(0.7)
    }
    private func header(_ value: WidgetSnapshot) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "chart.bar.xaxis").foregroundStyle(WidgetTone.emerald)
            Text("DigitPro").font(.system(size: 13, weight: .bold, design: .rounded))
            Spacer()
            Text(widgetMonth(value.month)).font(.system(size: 9, weight: .semibold)).foregroundStyle(WidgetTone.secondary)
        }
    }
    private func compactMetric(_ label: String, value: String, symbol: String, color: Color) -> some View {
        HStack(spacing: 7) {
            Image(systemName: symbol).font(.system(size: 10, weight: .semibold)).foregroundStyle(color)
                .frame(width: 20, height: 20).background(color.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 8, weight: .medium)).foregroundStyle(WidgetTone.secondary)
                Text(value).font(.system(size: 11, weight: .semibold, design: .rounded)).minimumScaleFactor(0.65).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }
    private func expenseMetric(_ label: String, value: Double?, change: Double?, symbol: String, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).font(.system(size: 10, weight: .semibold)).foregroundStyle(color)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 8, weight: .medium)).foregroundStyle(WidgetTone.secondary)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(widgetEuro(value)).font(.system(size: 12, weight: .semibold, design: .rounded))
                    Text(widgetChange(change)).font(.system(size: 8)).foregroundStyle(WidgetTone.secondary)
                }.minimumScaleFactor(0.65).lineLimit(1)
            }.accessibilityLabel(label + ", " + widgetEuro(value) + ", " + widgetChange(change) + " par rapport au mois précédent")
            Spacer(minLength: 0)
        }.frame(maxWidth: .infinity).padding(.horizontal, 9).padding(.vertical, 5)
            .background(WidgetTone.panel, in: RoundedRectangle(cornerRadius: 13))
    }
    private func tinyMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 8, weight: .medium)).foregroundStyle(WidgetTone.secondary)
            Text(value).font(.system(size: 10, weight: .semibold, design: .rounded)).minimumScaleFactor(0.55).lineLimit(1)
        }
    }
    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("DigitPro", systemImage: "chart.bar.xaxis").font(.headline).foregroundStyle(WidgetTone.emerald)
            Spacer()
            Text("Votre mois en un regard").font(.headline)
            Text("Ouvrez DigitPro pour actualiser le résumé.").font(.caption).foregroundStyle(WidgetTone.secondary)
        }
    }
}

private func widgetEuro(_ value: Double?) -> String {
    guard let value else { return "—" }
    return value.formatted(.currency(code: "EUR").precision(.fractionLength(0)).locale(Locale(identifier: "fr_FR")))
}
private func widgetMonth(_ key: String?) -> String {
    guard let key else { return "Ce mois" }
    let components = key.split(separator: "-")
    guard components.count == 2, let year = Int(components[0]), let month = Int(components[1]),
          let date = Calendar(identifier: .gregorian).date(from: DateComponents(year: year, month: month, day: 1)) else { return "Ce mois" }
    return date.formatted(.dateTime.month(.abbreviated).year().locale(Locale(identifier: "fr_FR"))).capitalized
}

@main
struct DigitProWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DigitProBalance", provider: BalanceProvider()) { entry in
            DigitProWidgetView(entry: entry)
        }.configurationDisplayName("Résumé mensuel DigitPro")
            .description("Entrées HT/TTC, activité sécurisée et répartition des dépenses du mois.")
            .supportedFamilies([.systemSmall, .systemMedium])
            .contentMarginsDisabled()
    }
}

private func widgetChange(_ value: Double?) -> String {
    guard let value else { return "n. c." }
    return (value > 0 ? "+" : "") + value.formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "fr_FR"))) + " %"
}

private func paymentDelay(_ days: Int) -> String {
    if days < 0 { return "Retard " + String(-days) + " j" }
    if days == 0 { return "Échéance aujourd’hui" }
    return "Prochaine : " + String(days) + " j"
}
