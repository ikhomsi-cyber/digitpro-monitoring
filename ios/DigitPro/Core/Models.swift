import Foundation

struct Overview: Decodable {
    let upcomingInvoice: UpcomingInvoice?
    let generatedRevenueHtEur: Double?
    let cashForecast: CashForecast?
    let version: Int
    let generatedAt: String
    let month: String
    let transactionCount: Int
    let balanceComparison: BalanceComparison?
    let expenses: ExpenseBreakdown?
    let widget: WidgetOverview?
    let activityMonths: [RevenueMonth]
    let dashboard: Dashboard
    let forecast: Forecast
    let treasury: Treasury
    let lmnp: LMNP
    let ndf: ExpenseSummary
}
struct UpcomingInvoice: Decodable {
    let amountHtEur: Double
    let amountTtcEur: Double
    let dueInDays: Int
    let statusLabel: String
}
struct CashForecast: Decodable {
    let receiptSchedule: [ForecastReceipt]?
    let bncPaidYtdEur: Double
    let expectedReceiptsTtcEur: Double?
    let expectedExpensesTtcEur: Double
    let projectedBalanceEur: Double?
    let basis: String
}
struct ForecastReceipt: Decodable {
    let date: String
    let amountTtcEur: Double
    let source: String
}
struct WidgetOverview: Decodable {
    let nextPaymentDays: Int?
    let outstandingInvoiceHtEur: Double?
    let digitProExpensesChangePercent: Double?
    let personalExpensesChangePercent: Double?

    let revenueTtcEur: Double
    let revenueHtEur: Double
    let workedDays: Int
    let securedRevenueHtEur: Double
    let digitProExpensesEur: Double
    let personalExpensesEur: Double
}
struct Dashboard: Decodable {
    let caMensuelEur: Double
    let soldeQontoEur: Double?
    let depensesQontoSasuMoisEur: Double
    let caAnnuelEncaisseHtEur: Double
    let netDansMaPocheMoisEur: Double
    let detteCsgDepuisDebutEur: Double
    let csgComparaison172Eur: Double
    let detteTvaDepuisDebutEur: Double
    let detteTotaleDepuisDebutEur: Double
    let resteAVerserApresCashEur: Double
    let ytdMonthly: [RevenueMonth]
}
struct RevenueMonth: Decodable, Identifiable {
    var id: String { month }
    let month: String
    let revenueHtEur: Double
    let expensesEur: Double
    let workedDays: Int?
    let tjmHtEur: Double?
}
struct Forecast: Decodable {
    let year: Int
    let projectedRevenueHtEur: Double
    let projectedPersonalIncomeEur: Double
    let projectedCsgEur: Double
    let projectedCashEur: Double
    let monthlySeries: [ForecastMonth]
    let confidence: Confidence
    let detail: ForecastDetail
}
struct Confidence: Decodable { let label: String; let score: Int }
struct ForecastDetail: Decodable { let basisLabel: String }
struct ForecastMonth: Decodable, Identifiable {
    var id: String { monthKey }
    let monthKey: String
    let monthLabel: String
    let revenueHt: Double
    let kind: String
}
struct Treasury: Decodable {
    let verseCeMois: Double
    let ikMois: Double
    let ndfMois: Double
    let bncMois: Double
}
struct LMNP: Decodable {
    let purchasePriceEur: Double
    let totalLoyers: Double
    let totalDepenses: Double
    let revenuNet: Double
    let rentabiliteBrutePct: Double?
    let rentabiliteNettePct: Double?
    let months: [RentalMonth]
}
struct RentalMonth: Decodable, Identifiable {
    var id: String { month }
    let month: String
    let loyers: Double
    let depenses: Double
    let net: Double
}
struct ExpenseSummary: Decodable { let totalEur: Double; let transactions: [ExpenseItem] }
struct ExpenseItem: Decodable, Identifiable {
    let id: String; let date: String; let label: String; let amount: Double
}
struct BankTransaction: Decodable, Identifiable {
    let vat: TransactionVAT?
    let id: String
    let date: String
    let label: String
    let category: String
    let amount: Double
    let balance: Double?
    let company: String
    let bank_name: String?
    let scope: String
}
struct TransactionVAT: Decodable {
    let rate: Double
    let amount: Double
    let ht: Double
    let ttc: Double
    let kind: String
}
struct TransactionPage: Decodable {
    let transactions: [BankTransaction]
    let total: Int
    let nextPage: Int?
}
extension Double {
    var euros: String { formatted(.currency(code: "EUR").locale(Locale(identifier: "fr_FR"))) }
}

struct BalanceComparison: Decodable {
    let deltaEur: Double
    let percent: Double?
}
struct ExpenseBreakdown: Decodable {
    let years: [ExpenseMonth]?
    let months: [ExpenseMonth]
}
struct ExpenseMonth: Decodable, Identifiable {
    var id: String { month }
    let month: String
    let totalHt: Double
    let totalTtc: Double
    let categories: [ExpenseCategory]
    let personalExpensesEur: Double?
    let digitProExpensesEur: Double?
    let personalChangePercent: Double?
    let digitProChangePercent: Double?
}
struct ExpenseCategory: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let color: String
    var amountHt: Double
    var amountTtc: Double
    var count: Int
}
struct ExpenseDetailPage: Decodable {
    let taxNetTotal: Double?
    let recoverableVat: Double?
    let category: String
    let month: String
    let total: Int
    let totalHt: Double
    let totalTtc: Double
    let transactions: [ExpenseMovement]
    let nextPage: Int?
}
struct ExpenseMovement: Decodable, Identifiable {
    let id: String
    let date: String
    let label: String
    let bankName: String
    let amountHt: Double
    let amountTtc: Double
}

struct ActivityResponse: Decodable {
    let expensesByMonth: [String: ActivityExpenses]?
    let version: Int
    let generatedAt: String
    let month: String
    let monthTitle: String
    let today: String
    let currentTjmHt: Double
    let annualTargetHt: Double?
    let mileageExtraKm: Double
    let kpis: ActivityKPIs
    let gauge: ActivityGauge
    let productivity: ActivityProductivity
    let performance: ActivityPerformance
    let pace: ActivityPace
    let annualObjective: AnnualObjective?
    let history: [ActivityHistoryMonth]
    let days: [ActivityDay]
}
struct ActivityExpenses: Decodable {
    let ikEur: Double
    let ikYearToDateEur: Double
    let km: Double
    let commuteDays: Int
    let ndf: ExpenseSummary
}
struct ActivityMonthResponse: Decodable {
    let expenses: ActivityExpenses?
    let version: Int
    let generatedAt: String
    let month: String
    let monthTitle: String
    let today: String
    let currentTjmHt: Double
    let mileageExtraKm: Double
    let kpis: ActivityKPIs
    let gauge: ActivityGauge
    let days: [ActivityDay]
    init(_ value: ActivityResponse) {
        expenses = value.expensesByMonth?[value.month]
        version = value.version; generatedAt = value.generatedAt; month = value.month
        monthTitle = value.monthTitle; today = value.today; currentTjmHt = value.currentTjmHt
        mileageExtraKm = value.mileageExtraKm; kpis = value.kpis; gauge = value.gauge; days = value.days
    }
}
struct ActivityKPIs: Decodable {
    let jours: Int
    let caEstime: Double
    let resteAFacturer: Double
    let projectionFinMois: Double
}
struct ActivityGauge: Decodable {
    let countedBillable: Int
    let totalBillableMonth: Int
    let remainingBillable: Int
    let isCurrent: Bool
}
struct ActivityProductivity: Decodable {
    let currentTjmHt: Double
    let workedDays: Int
    let averageDaysPerMonth: Double
    let projectedAnnualRevenueHt: Double
    let viewYear: Int
}
struct ActivityPerformance: Decodable {
    let year: Int
    let currentTjmHt: Double
    let averageTjmYtd: Double
    let bestMonth: ActivityTJMSnapshot
    let worstMonth: ActivityTJMSnapshot
}
struct ActivityTJMSnapshot: Decodable {
    let monthKey: String
    let monthLabel: String
    let tjmHt: Double
    let workedDays: Int
}
struct ActivityPace: Decodable {
    let year: Int
    let forecastDateLabel: String
    let monthsElapsed: Int
    let workedDaysYtd: Int
    let averageDaysPerMonth: Double
    let expectedWorkedDays: Double
    let expectedAnnualRevenueHt: Double
    let expectedPersonalIncomeEur: Double
    let basisLabel: String
}
struct AnnualObjective: Decodable {
    let year: Int
    let targetHtEur: Double
    let achievedHtEur: Double
    let remainingHtEur: Double
    let completionPct: Double
}
struct ActivityHistoryMonth: Decodable, Identifiable {
    var id: String { monthKey }
    let monthKey: String
    let label: String
    let days: Double
    let caHt: Double
    let tjmHt: Double
    let sourceMonthKey: String
    let kind: String
    let plannedDays: Double?
    let plannedCaHt: Double?
}
struct ActivityDay: Decodable, Identifiable {
    var id: String { iso }
    let iso: String
    let day: Int
    let weekday: Int
    let billable: Bool
    let worked: Bool
    let vacation: Bool
    let commute: Bool
    let holiday: String?
    let schoolVacation: String?
}
struct ActivityMutationAck: Decodable { let ok: Bool }
struct ActivityDayMutation: Encodable { let kind: String; let date: String; let selected: Bool }
struct ActivityTargetMutation: Encodable { let kind = "target"; let value: Double? }
struct ActivityMileageMutation: Encodable { let kind = "mileage"; let month: String; let value: Double }
