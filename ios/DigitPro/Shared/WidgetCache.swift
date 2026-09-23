import Foundation
import WidgetKit

struct WidgetSnapshot: Codable {
    let nextPaymentDays: Int?
    let outstandingInvoiceHtEur: Double?
    let digitProExpensesChangePercent: Double?
    let personalExpensesChangePercent: Double?

    let updatedAt: Date
    let balance: Double?
    let month: String?
    let revenueTtcEur: Double?
    let revenueHtEur: Double?
    let workedDays: Int?
    let totalWorkdays: Int?
    let securedRevenueHtEur: Double?
    let securedRevenueTargetHtEur: Double?
    let digitProExpensesEur: Double?
    let personalExpensesEur: Double?
    let ikEur: Double?
    let ndfEur: Double?
}
enum WidgetCache {
    static var defaults: UserDefaults? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "DIGITPRO_APP_GROUP") as? String,
              !group.isEmpty, !group.contains("$(") else { return nil }
        return UserDefaults(suiteName: group)
    }
    static func save(balance: Double?, month: String?, revenueTtcEur: Double?, revenueHtEur: Double?,
                     workedDays: Int?, totalWorkdays: Int?, securedRevenueHtEur: Double?, securedRevenueTargetHtEur: Double?, digitProExpensesEur: Double?,
                     personalExpensesEur: Double?, ikEur: Double?, ndfEur: Double?, digitProExpensesChangePercent: Double?, personalExpensesChangePercent: Double?, outstandingInvoiceHtEur: Double?, nextPaymentDays: Int?) {
        let snapshot = WidgetSnapshot(nextPaymentDays: nextPaymentDays, outstandingInvoiceHtEur: outstandingInvoiceHtEur, digitProExpensesChangePercent: digitProExpensesChangePercent, personalExpensesChangePercent: personalExpensesChangePercent, updatedAt: Date(), balance: balance, month: month,
            revenueTtcEur: revenueTtcEur, revenueHtEur: revenueHtEur, workedDays: workedDays,
            totalWorkdays: totalWorkdays, securedRevenueHtEur: securedRevenueHtEur,
            securedRevenueTargetHtEur: securedRevenueTargetHtEur, digitProExpensesEur: digitProExpensesEur,
            personalExpensesEur: personalExpensesEur, ikEur: ikEur, ndfEur: ndfEur)
        defaults?.set(try? JSONEncoder().encode(snapshot), forKey: "snapshot")
        WidgetCenter.shared.reloadAllTimelines()
    }
    static func read() -> WidgetSnapshot? {
        guard let data = defaults?.data(forKey: "snapshot"),
              let result = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
              Date().timeIntervalSince(result.updatedAt) < 86400 else { return nil }
        return result
    }
    static func clear() {
        defaults?.removeObject(forKey: "snapshot")
        WidgetCenter.shared.reloadAllTimelines()
    }
}
