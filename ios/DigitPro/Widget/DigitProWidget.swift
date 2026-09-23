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
    static func emerald(dark: Bool) -> Color { hex(dark ? 0x6EE7A0 : 0x047857) }
    static func blue(dark: Bool) -> Color { hex(dark ? 0x7DD3FC : 0x0369A1) }
    static func mauve(dark: Bool) -> Color { hex(dark ? 0xD8B4FE : 0x7E22CE) }
    static func primary(dark: Bool) -> Color { hex(dark ? 0xF3FFF7 : 0x123522) }
    static func secondary(dark: Bool) -> Color { hex(dark ? 0xB7D2C1 : 0x526B5A) }
    static func panel(dark: Bool) -> Color { dark ? .white.opacity(0.09) : .white.opacity(0.78) }
    static func progressTrack(dark: Bool) -> Color { dark ? .white.opacity(0.18) : hex(0xA7CDB3).opacity(0.55) }
    static func background(dark: Bool) -> [Color] {
        dark ? [hex(0x073B25), hex(0x031E14)] : [hex(0xF0FAF3), hex(0xDCEFE2)]
    }
    private static func hex(_ value: UInt32) -> Color {
        Color(.sRGB, red: Double((value >> 16) & 255) / 255,
              green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255, opacity: 1)
    }
}

struct DigitProWidgetView: View {
    let entry: BalanceEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    private var darkMode: Bool { colorScheme == .dark }
    var body: some View {
        Group {
            if let snapshot = entry.snapshot, snapshot.revenueTtcEur != nil {
                if family == .systemSmall { small(snapshot) } else { medium(snapshot) }
            } else { emptyState }
        }
        .padding(12)
        .foregroundStyle(WidgetTone.primary(dark: darkMode))
        .containerBackground(for: .widget) {
            LinearGradient(colors: WidgetTone.background(dark: darkMode),
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
    private func medium(_ value: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            header(value)
            receivable(value)
            VStack(alignment: .leading, spacing: 2) {
                Label("ENTRÉES DU MOIS", systemImage: "arrow.down.left")
                    .font(.system(size: 8, weight: .bold)).tracking(0.7).foregroundStyle(WidgetTone.emerald(dark: darkMode))
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(widgetEuro(value.revenueTtcEur)).font(.system(size: 19, weight: .semibold, design: .rounded)).minimumScaleFactor(0.65).lineLimit(1)
                    Text("\(widgetEuro(value.revenueHtEur)) HT encaissé")
                        .font(.system(size: 8, weight: .medium)).foregroundStyle(WidgetTone.secondary(dark: darkMode)).lineLimit(1)
                }
            }
            HStack(spacing: 8) {
                progressMetric("Jours", completed: Double(value.workedDays ?? 0), target: value.totalWorkdays.map(Double.init), unit: "j", color: WidgetTone.blue(dark: darkMode), ringSize: 36)
                progressMetric("CA sécurisé", completed: value.securedRevenueHtEur, target: value.securedRevenueTargetHtEur, unit: "€ HT", color: WidgetTone.emerald(dark: darkMode), ringSize: 36)
            }
            HStack(spacing: 10) {
                compactStat("DigitPro", widgetEuro(value.digitProExpensesEur), WidgetTone.blue(dark: darkMode))
                compactStat("Perso", widgetEuro(value.personalExpensesEur), WidgetTone.mauve(dark: darkMode))
                compactStat("IK à date", widgetEuro(value.ikEur), WidgetTone.blue(dark: darkMode))
                compactStat("NDF", widgetEuro(value.ndfEur), WidgetTone.emerald(dark: darkMode))
            }
        }.privacySensitive()
    }
    private func small(_ value: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            header(value)
            receivable(value)
            VStack(alignment: .leading, spacing: 2) {
                Text(widgetEuro(value.revenueTtcEur)).font(.system(size: 20, weight: .semibold, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1)
                Text("\(widgetEuro(value.revenueHtEur)) HT · entrées").font(.system(size: 9, weight: .medium)).foregroundStyle(WidgetTone.emerald(dark: darkMode))
            }
            HStack(spacing: 4) {
                smallProgress("Jours", completed: Double(value.workedDays ?? 0), target: value.totalWorkdays.map(Double.init),
                              unit: "j", color: WidgetTone.blue(dark: darkMode), ringSize: 26)
                smallProgress("CA sûr", completed: value.securedRevenueHtEur, target: value.securedRevenueTargetHtEur,
                              unit: "€", color: WidgetTone.emerald(dark: darkMode), ringSize: 26)
            }
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) { tinyMetric("DigitPro", widgetEuro(value.digitProExpensesEur)); tinyMetric("Perso", widgetEuro(value.personalExpensesEur)) }
                HStack(spacing: 6) { tinyMetric("IK à date", widgetEuro(value.ikEur)); tinyMetric("NDF", widgetEuro(value.ndfEur)) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
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
            Image(systemName: "clock").foregroundStyle(WidgetTone.emerald(dark: darkMode))
            Text("À encaisser").foregroundStyle(WidgetTone.secondary(dark: darkMode))
            Text(widgetEuro(value.outstandingInvoiceHtEur.map { ($0 * 120).rounded() / 100 }) + " TTC").fontWeight(.semibold)
            if let days = paymentDays(value) { Text(paymentCountdown(days)).foregroundStyle(WidgetTone.secondary(dark: darkMode)) }
        }.font(.system(size: 10)).lineLimit(1).minimumScaleFactor(0.7)
    }
    private func header(_ value: WidgetSnapshot) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "chart.bar.xaxis").foregroundStyle(WidgetTone.emerald(dark: darkMode))
            Text("DigitPro").font(.system(size: 13, weight: .bold, design: .rounded))
            Spacer()
            Text(widgetMonth(value.month)).font(.system(size: 9, weight: .semibold)).foregroundStyle(WidgetTone.secondary(dark: darkMode))
        }
    }
    private func progressMetric(_ label: String, completed: Double?, target: Double?, unit: String, color: Color, ringSize: CGFloat) -> some View {
        let done = max(0, completed ?? 0)
        let total = max(0, target ?? 0)
        let remaining = max(0, total - done)
        return HStack(spacing: 6) {
            WidgetProgressRing(completed: done, target: target, color: color, trackColor: WidgetTone.progressTrack(dark: darkMode), size: ringSize)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 8, weight: .medium)).foregroundStyle(WidgetTone.secondary(dark: darkMode)).lineLimit(1)
                Text(unit == "j" ? "\(Int(done))/\(Int(total)) j" : widgetEuro(done) + " HT")
                    .font(.system(size: 10, weight: .semibold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
                Text(unit == "j" ? "Reste \(Int(remaining)) j" : "Reste " + widgetEuro(remaining))
                    .font(.system(size: 7)).foregroundStyle(WidgetTone.secondary(dark: darkMode)).lineLimit(1).minimumScaleFactor(0.65)
            }
            Spacer(minLength: 0)
        }.accessibilityElement(children: .ignore)
            .accessibilityLabel("\(label), \(Int(done)) sur \(Int(total)) \(unit), reste \(Int(remaining)) \(unit)")
    }
    private func smallProgress(_ label: String, completed: Double?, target: Double?, unit: String, color: Color, ringSize: CGFloat) -> some View {
        let done = max(0, completed ?? 0)
        let total = max(0, target ?? 0)
        return VStack(spacing: 1) {
            WidgetProgressRing(completed: completed, target: target, color: color, trackColor: WidgetTone.progressTrack(dark: darkMode), size: ringSize)
            Text(label).font(.system(size: 7, weight: .medium)).foregroundStyle(WidgetTone.secondary(dark: darkMode)).lineLimit(1)
            Text(unit == "j" ? "\(Int(done))/\(Int(total)) j" : widgetEuro(done))
                .font(.system(size: 8, weight: .semibold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.55)
        }.frame(maxWidth: .infinity)
            .accessibilityElement(children: .combine)
    }
    private func expenseMetric(_ label: String, value: Double?, change: Double?, symbol: String, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).font(.system(size: 10, weight: .semibold)).foregroundStyle(color)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 8, weight: .medium)).foregroundStyle(WidgetTone.secondary(dark: darkMode))
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(widgetEuro(value)).font(.system(size: 12, weight: .semibold, design: .rounded))
                    Text(widgetChange(change)).font(.system(size: 8)).foregroundStyle(WidgetTone.secondary(dark: darkMode))
                }.minimumScaleFactor(0.65).lineLimit(1)
            }.accessibilityLabel(label + ", " + widgetEuro(value) + ", " + widgetChange(change) + " par rapport au mois précédent")
            Spacer(minLength: 0)
        }.frame(maxWidth: .infinity).padding(.horizontal, 9).padding(.vertical, 5)
            .background(WidgetTone.panel(dark: darkMode), in: RoundedRectangle(cornerRadius: 13))
    }
    private func tinyMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 8, weight: .medium)).foregroundStyle(WidgetTone.secondary(dark: darkMode))
            Text(value).font(.system(size: 10, weight: .semibold, design: .rounded)).minimumScaleFactor(0.55).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    private func compactStat(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 7, weight: .medium)).foregroundStyle(WidgetTone.secondary(dark: darkMode)).lineLimit(1)
            Text(value).font(.system(size: 9, weight: .semibold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
        }.frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 5).padding(.vertical, 3)
            .background(color.opacity(darkMode ? 0.13 : 0.08), in: RoundedRectangle(cornerRadius: 8))
    }
    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("DigitPro", systemImage: "chart.bar.xaxis").font(.headline).foregroundStyle(WidgetTone.emerald(dark: darkMode))
            Spacer()
            Text("Votre mois en un regard").font(.headline)
            Text("Ouvrez DigitPro pour actualiser le résumé.").font(.caption).foregroundStyle(WidgetTone.secondary(dark: darkMode))
        }
    }
}

private struct WidgetProgressRing: View {
    let completed: Double?
    let target: Double?
    let color: Color
    let trackColor: Color
    let size: CGFloat

    private var fraction: Double {
        guard let completed, let target, target > 0 else { return 0 }
        return min(1, max(0, completed / target))
    }

    var body: some View {
        ZStack {
            Circle().stroke(trackColor, lineWidth: size > 25 ? 4 : 3)
            Circle().trim(from: 0, to: fraction)
                .stroke(color, style: StrokeStyle(lineWidth: size > 25 ? 4 : 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Image(systemName: "checkmark").font(.system(size: size > 25 ? 10 : 7, weight: .bold))
                .foregroundStyle(color.opacity(fraction > 0 ? 1 : 0.5))
        }.frame(width: size, height: size).accessibilityHidden(true)
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

private func paymentCountdown(_ days: Int) -> String {
    if days < 0 { return "(retard \(-days) j)" }
    if days == 0 { return "(aujourd’hui)" }
    return "(\(days) j)"
}
