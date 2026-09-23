import SwiftUI
import LocalAuthentication
import Supabase
import UserNotifications

enum AppTab: Hashable { case dashboard, activity, transactions, forecast, finance, settings }

@MainActor
final class AppStore: ObservableObject {
    @Published private(set) var api: MobileAPI?
    @Published var configurationError: String?
    @Published var signedIn = false
    @Published var restoring = true
    @Published var locked = false
    @Published var busy = false
    @Published var error: String?
    @Published var overview: Overview?
    @Published var selectedTab: AppTab = .dashboard
    @Published var refreshing = false
    @Published var overviewError: String?
    private var refreshID = UUID()
    @Published var faceID = UserDefaults.standard.bool(forKey: "digitpro.faceID")
    @Published var widgetEnabled = UserDefaults.standard.bool(forKey: "digitpro.widget")
    var activityMonths: [String: (value: ActivityMonthResponse, fetchedAt: Date)] = [:]
    var activitySummary: (value: ActivityResponse, fetchedAt: Date)?
    // Session-only cache, including pages explicitly loaded by the user.
    var transactionPages: [String: TransactionPage] = [:]
    private var expensePages: [String: (value: ExpenseDetailPage, fetchedAt: Date)] = [:]
    private(set) var expenseRevision = UUID()
    func cachedExpense(category: String, period: String) -> ExpenseDetailPage? {
        guard let cached = expensePages[period + "|" + category], Date().timeIntervalSince(cached.fetchedAt) < 300 else { return nil }
        return cached.value
    }
    func cacheExpense(_ value: ExpenseDetailPage, revision: UUID) {
        guard signedIn, revision == expenseRevision else { return }
        if expensePages.count >= 32 { expensePages.removeAll() }
        expensePages[value.month + "|" + value.category] = (value, Date())
    }
    func invalidateExpenses() {
        expenseRevision = UUID()
        expensePages.removeAll()
    }
    private var generation = 0
    private var authenticating = false

    init() {
        do { api = MobileAPI(configuration: try Configuration.load()) }
        catch { configurationError = error.localizedDescription }
    }
    func restore() async {
        defer { restoring = false }
        guard let api else { return }
        signedIn = api.supabase.auth.currentSession != nil
        locked = signedIn && faceID
        if signedIn && !locked { await refresh() }
    }
    func signIn(email: String, password: String) async {
        guard let api, !busy else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            _ = try await api.supabase.auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            signedIn = true; locked = false
            await refresh()
        } catch { self.error = error.localizedDescription }
    }
    func refresh() async {
        guard let api, signedIn, !locked else { return }
        let requestGeneration = generation
        let identity = UUID(); refreshID = identity
        prefetchCurrentActivityMonth(using: api, generation: requestGeneration)
        refreshing = true; overviewError = nil
        defer { if refreshID == identity { refreshing = false } }
        do {
            let result: Overview = try await api.get("overview")
            guard requestGeneration == generation, refreshID == identity, signedIn else { return }
            guard result.version == 1 else { throw APIError.invalidResponse }
            invalidateExpenses()
            overview = result; overviewError = nil
            if widgetEnabled && !faceID { saveWidget(result) }
        } catch is CancellationError {
            // SwiftUI peut annuler la tâche liée au geste de pull-to-refresh.
            // Une annulation UI ne doit pas devenir une erreur visible dans le Dashboard.
        } catch let failure as URLError where failure.code == .cancelled {
            // URLSession expose parfois l’annulation sous forme d’URLError.cancelled.
        } catch {
            guard requestGeneration == generation, refreshID == identity else { return }
            overviewError = error.localizedDescription
            if case APIError.expired = error { await signOut() }
        }
    }
    private func prefetchCurrentActivityMonth(using api: MobileAPI, generation requestGeneration: Int) {
        let calendar = Calendar(identifier: .gregorian)
        let now = Date()
        let key = String(format: "%04d-%02d", calendar.component(.year, from: now), calendar.component(.month, from: now))
        if let cached = activityMonths[key], cached.value.expenses != nil,
           Date().timeIntervalSince(cached.fetchedAt) < 300 { return }
        Task { [weak self] in
            guard let self else { return }
            do {
                let value: ActivityMonthResponse = try await api.get("activity/month", query: [URLQueryItem(name: "month", value: key)])
                guard self.generation == requestGeneration, self.signedIn, !self.locked else { return }
                self.activityMonths[key] = (value, Date())
                if self.widgetEnabled, let overview = self.overview { self.saveWidget(overview) }
            } catch {
                // The Dashboard remains usable; Activity will retry when opened.
            }
        }
    }
    func signOut() async {
        generation += 1
        activityMonths.removeAll(); activitySummary = nil
        transactionPages.removeAll()
        invalidateExpenses()
        signedIn = false; overview = nil; locked = false; overviewError = nil; selectedTab = .dashboard
        WidgetCache.clear()
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        // Local scope preserves the existing web session.
        do { try await api?.supabase.auth.signOut(scope: .local) }
        catch { self.error = "Déconnexion incomplète : \(error.localizedDescription)" }
    }
    func protect() {
        if signedIn && faceID { locked = true }
    }
    func unlock() async {
        guard !authenticating else { return }
        authenticating = true
        defer { authenticating = false }
        do {
            let accepted = try await LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Accéder à vos comptes DigitPro")
            if accepted { locked = false; error = nil; await refresh() }
        } catch { self.error = error.localizedDescription }
    }
    func setFaceID(_ enabled: Bool) async {
        authenticating = true
        defer { authenticating = false }
        do {
            guard try await LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Modifier la protection de DigitPro") else { return }
            faceID = enabled
            UserDefaults.standard.set(enabled, forKey: "digitpro.faceID")
            if enabled { setWidget(false) }
        } catch { self.error = error.localizedDescription }
    }
    func setWidget(_ enabled: Bool) {
        widgetEnabled = enabled && !faceID
        UserDefaults.standard.set(widgetEnabled, forKey: "digitpro.widget")
        if widgetEnabled, let overview { saveWidget(overview) }
        else { WidgetCache.clear() }
    }
    private func saveWidget(_ overview: Overview) {
        let value = overview.widget
        let activityExpenses = activityMonths[overview.month]?.value.expenses
        WidgetCache.save(balance: overview.dashboard.soldeQontoEur, month: overview.month,
            revenueTtcEur: value?.revenueTtcEur, revenueHtEur: value?.revenueHtEur,
            workedDays: value?.workedDays, totalWorkdays: value?.totalWorkdays,
            securedRevenueHtEur: value?.securedRevenueHtEur, securedRevenueTargetHtEur: value?.securedRevenueTargetHtEur,
            digitProExpensesEur: value?.digitProExpensesEur, personalExpensesEur: value?.personalExpensesEur,
            ikEur: activityExpenses?.ikEur, ndfEur: activityExpenses?.ndf.totalEur,
            digitProExpensesChangePercent: value?.digitProExpensesChangePercent, personalExpensesChangePercent: value?.personalExpensesChangePercent, outstandingInvoiceHtEur: value?.outstandingInvoiceHtEur, nextPaymentDays: value?.nextPaymentDays)
    }
    func enableReminder() async {
        do {
            let center = UNUserNotificationCenter.current()
            guard try await center.requestAuthorization(options: [.alert, .sound]) else {
                error = "Les notifications sont désactivées dans les réglages iOS."; return
            }
            let content = UNMutableNotificationContent()
            content.title = "Votre point DigitPro"
            content.body = "Prenez un instant pour consulter votre activité et votre trésorerie."
            content.sound = .default
            var date = DateComponents(); date.weekday = 2; date.hour = 9
            try await center.add(UNNotificationRequest(identifier: "digitpro.weekly", content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: date, repeats: true)))
        } catch { self.error = error.localizedDescription }
    }
}
