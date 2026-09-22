import SwiftUI

// Shared with the web: emerald accent, petroleum background, SF typography.
enum DP {
    static var isObsidian: Bool { UserDefaults.standard.string(forKey: "digitpro.colorTheme") == "obsidian" }
    static var isPearl: Bool { UserDefaults.standard.string(forKey: "digitpro.colorTheme") == "pearl" }
    static var accent: Color { Color(hex: isObsidian ? 0xE6CFAB : isPearl ? 0xCBD5E1 : 0x34D399) }
    static var teal: Color { Color(hex: isObsidian ? 0xA5C9B5 : isPearl ? 0x94A3B8 : 0x10B981) }
    static var blue: Color { Color(hex: isObsidian ? 0xABC1DC : 0x38BDF8) }
    static var amber: Color { Color(hex: isObsidian ? 0xDEC49A : 0xFBBF24) }
    static var rose: Color { Color(hex: isObsidian ? 0xDFA4AB : 0xFB7185) }
    static let ink = Color(hex: 0x152F36)
    static func background(_ scheme: ColorScheme) -> Color {
        if isObsidian { return Color(hex: 0x090A0C) }
        return scheme == .dark ? Color(hex: isPearl ? 0x121820 : 0x03191F) : Color(hex: isPearl ? 0xF6F7F9 : 0xF5F5F7)
    }
    static func surface(_ scheme: ColorScheme) -> Color {
        if isObsidian { return Color(hex: 0x1B1D22) }
        return scheme == .dark ? Color(hex: isPearl ? 0x26313F : 0x183740) : .white
    }
    static func border(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.085) : Color.black.opacity(0.055)
    }
    static func tint(_ scheme: ColorScheme) -> Color { scheme == .dark ? accent : Color(hex: isPearl ? 0x475569 : 0x047857) }
}
extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 255) / 255,
                  green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: 1)
    }
}
struct PageBackground: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        ZStack(alignment: .top) {
            DP.background(scheme)
            if scheme == .dark {
                LinearGradient(colors: [Color(hex: DP.isObsidian ? 0x292A2E : DP.isPearl ? 0x334155 : 0x0C5361), Color(hex: DP.isObsidian ? 0x141519 : DP.isPearl ? 0x1F2937 : 0x06343D), DP.background(scheme)], startPoint: .top, endPoint: .bottom)
                    .frame(height: 760)
                RadialGradient(colors: [(DP.isObsidian ? DP.accent : .white).opacity(DP.isObsidian ? 0.06 : 0.11), .clear], center: .topLeading, startRadius: 0, endRadius: 420)
            }
        }.ignoresSafeArea()
    }
}
struct DPCard<Content: View>: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @Environment(\.colorScheme) private var scheme
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        content.padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(DP.surface(scheme), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(DP.border(scheme), lineWidth: 1) }
    }
}
struct PageScroll<Content: View>: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) { content }
                .frame(maxWidth: 720).padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 32)
                .frame(maxWidth: .infinity)
        }.scrollBounceBehavior(.always).background { PageBackground() }
    }
}
struct DPMetricTile: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @Environment(\.colorScheme) private var scheme
    let title: String
    let value: String
    var caption: String? = nil
    let symbol: String
    var color: Color = DP.accent

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol).font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color).frame(width: 36, height: 36)
                .background(color.opacity(0.12), in: Circle())
                .accessibilityHidden(true)
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.system(.title3, design: .rounded, weight: .semibold))
                .minimumScaleFactor(0.65).lineLimit(1).monospacedDigit()
            if let caption { Text(caption).font(.caption2).foregroundStyle(.secondary).lineLimit(2) }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(17)
            .background(DP.surface(scheme), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(DP.border(scheme), lineWidth: 1) }
    }
}
struct Eyebrow: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let text: String
    var body: some View { Text(text.uppercased()).font(.system(size: 10, weight: .bold)).tracking(2.3).foregroundStyle(.secondary) }
}
struct SectionHeading: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let title: String
    var subtitle: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.system(.title3, design: .rounded, weight: .semibold))
            if let subtitle { Text(subtitle).font(.caption).foregroundStyle(.secondary) }
        }
    }
}
struct BrandMark: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    var size: CGFloat = 42
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28).fill(LinearGradient(colors: [Color(hex: DP.isObsidian ? 0x353437 : 0x22414A), Color(hex: DP.isObsidian ? 0x17181C : 0x09232B)], startPoint: .topLeading, endPoint: .bottomTrailing))
            HStack(alignment: .bottom, spacing: size * 0.08) {
                ForEach(0..<3) { index in
                    RoundedRectangle(cornerRadius: 2).fill(.white)
                        .frame(width: size * 0.09, height: size * (0.20 + Double(index) * 0.12))
                }
            }.offset(x: -size * 0.04, y: size * 0.025)
            Circle().fill(DP.accent).frame(width: size * 0.13, height: size * 0.13)
                .offset(x: size * 0.26, y: -size * 0.25)
        }.frame(width: size, height: size).accessibilityHidden(true)
    }
}
struct SymbolBadge: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let symbol: String
    var color: Color = DP.teal
    var body: some View {
        Image(systemName: symbol).font(.system(size: 17, weight: .semibold))
            .foregroundStyle(color).frame(width: 44, height: 44)
            .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 15))
            .accessibilityHidden(true)
    }
}
struct MoneyRow: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let title: String
    let amount: Double?
    var symbol: String? = nil
    var color: Color = DP.teal
    var body: some View {
        HStack(spacing: 12) {
            if let symbol { SymbolBadge(symbol: symbol, color: color) }
            Text(title).font(.subheadline)
            Spacer(minLength: 8)
            Text(amount?.euros ?? "—").font(.system(.subheadline, design: .rounded, weight: .semibold))
                .monospacedDigit().multilineTextAlignment(.trailing)
        }.padding(.vertical, 7)
    }
}
struct Pill: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let text: String
    var symbol: String? = nil
    var color: Color = DP.teal
    var body: some View {
        HStack(spacing: 5) {
            if let symbol { Image(systemName: symbol) }
            Text(text)
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(color)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(color.opacity(0.11), in: Capsule())
    }
}
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: ButtonStyleConfiguration) -> some View {
        configuration.label.font(.system(.body, weight: .semibold))
            .foregroundStyle(Color(hex: 0x032A23)).frame(maxWidth: .infinity).padding(.vertical, 17)
            .background(DP.accent.opacity(configuration.isPressed ? 0.75 : 1), in: RoundedRectangle(cornerRadius: 18))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}
struct InlineError: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    let message: String
    let retry: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "wifi.exclamationmark").foregroundStyle(DP.amber)
            VStack(alignment: .leading, spacing: 7) {
                Text(message).font(.caption)
                Button("Réessayer", action: retry).font(.caption.bold())
            }
            Spacer(minLength: 0)
        }.padding(16).background(DP.amber.opacity(0.09), in: RoundedRectangle(cornerRadius: 18))
    }
}
struct LoadingOverview: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    var body: some View {
        VStack(spacing: 22) {
            BrandMark(size: 64)
            Text(store.refreshing ? "Votre activité prend forme…" : "Retrouvons vos données").font(.title3.weight(.semibold))
            if store.refreshing { ProgressView().tint(DP.accent) }
            else {
                Text(store.overviewError ?? "Votre compte DigitPro est prêt à être synchronisé.")
                    .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Button("Actualiser") { Task { await store.refresh() } }.buttonStyle(PrimaryButtonStyle())
            }
        }.frame(maxWidth: .infinity).padding(.vertical, 65)
    }
}
func monthLabel(_ key: String, abbreviated: Bool = true) -> String {
    let parts = key.split(separator: "-")
    guard parts.count >= 2, let year = Int(parts[0]), let month = Int(parts[1]),
          let date = Calendar(identifier: .gregorian).date(from: DateComponents(year: year, month: month, day: 1)) else { return key }
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "fr_FR")
    formatter.dateFormat = abbreviated ? "MMM" : "MMMM yyyy"
    return formatter.string(from: date)
}
func dayLabel(_ iso: String) -> String {
    let parser = DateFormatter(); parser.locale = Locale(identifier: "en_US_POSIX"); parser.dateFormat = "yyyy-MM-dd"
    guard let date = parser.date(from: iso) else { return iso }
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "fr_FR"); formatter.dateFormat = "d MMMM yyyy"
    return formatter.string(from: date)
}
