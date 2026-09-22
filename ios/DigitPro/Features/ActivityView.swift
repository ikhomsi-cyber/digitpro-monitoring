import SwiftUI
import Charts

struct ActivityView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var month = Date()
    @State private var data: ActivityResponse?
    @State private var monthData: ActivityMonthResponse?
    @State private var loading = false
    @State private var loadingHistory = false
    @State private var historyRequestID = UUID()
    @State private var monthRequestID = UUID()
    @State private var savingDate: String?
    @State private var error: String?
    @State private var mode: ActivityMode = .worked
    @State private var mileageDraft = ""
    @State private var selectedHistoryMonth: String?
    private var monthKey: String {
        let calendar = Calendar(identifier: .gregorian)
        return String(format: "%04d-%02d", calendar.component(.year, from: month), calendar.component(.month, from: month))
    }
    var body: some View {
        PageScroll {
            HStack(spacing: 12) {
                BrandMark(size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Activité").font(.system(.title2, design: .rounded, weight: .bold))
                    Text("Calendrier, TJM et rythme de facturation").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button { Task { await refreshActivity() } } label: {
                    if loading { ProgressView().frame(width: 42, height: 42) }
                    else { Image(systemName: "arrow.clockwise").frame(width: 42, height: 42).background(DP.surface(scheme), in: Circle()) }
                }.disabled(loading).accessibilityLabel("Actualiser l’activité")
            }
            if let error { InlineError(message: error) { Task { await refreshActivity() } } }
            if let monthData {
                activityHero(monthData)
                calendarCard(monthData)
                monthIndicators(monthData)
                if let expenses = monthData.expenses { activityExpenses(expenses) }
                if let data {
                    historyCard(data)
                    performanceCard(data)
                } else if loadingHistory {
                    ProgressView("Chargement de l’historique…").font(.caption).frame(maxWidth: .infinity)
                }
                Text("Mis à jour le \(displayActivityTimestamp(monthData.generatedAt))")
                    .font(.system(size: 10)).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
            } else if loading {
                VStack(spacing: 16) { ProgressView(); Text("Chargement de votre activité…").font(.subheadline).foregroundStyle(.secondary) }
                    .frame(maxWidth: .infinity).padding(.vertical, 80)
            }
        }.toolbar(.hidden, for: .navigationBar)
            .task(id: monthKey) {
                await loadMonth()
                guard !Task.isCancelled else { return }
                if data == nil { await loadFull() }
            }
            .refreshable { await refreshActivity() }
    }
    private func activityHero(_ value: ActivityMonthResponse) -> some View {
        DPCard {
            VStack(spacing: 17) {
                HStack { Pill(text: "CA SÉCURISÉ · HT", symbol: "checkmark.shield", color: DP.tint(scheme)); Spacer(); Text(value.currentTjmHt.euros + " / j").font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                Text(value.kpis.caEstime.euros).font(.system(size: 44, weight: .semibold, design: .rounded)).tracking(-1.8).minimumScaleFactor(0.55).lineLimit(1)
                HStack(spacing: 5) {
                    Image(systemName: "calendar.badge.checkmark")
                    Text("\(value.gauge.countedBillable) jours réalisés · \(value.gauge.totalBillableMonth) planifiés")
                }.font(.subheadline.weight(.semibold)).foregroundStyle(DP.tint(scheme))
                ProgressView(value: Double(value.gauge.countedBillable), total: Double(max(1, value.gauge.totalBillableMonth))).tint(DP.tint(scheme))
            }
        }
    }
    private func calendarCard(_ value: ActivityMonthResponse) -> some View {
        DPCard {
        VStack(spacing: 17) {
            HStack {
                Button { moveMonth(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                Spacer()
                VStack(spacing: 3) {
                    Text(value.monthTitle).font(.headline).textCase(.none)
                    Button("Aujourd’hui") { month = Date() }.font(.caption2.weight(.semibold)).foregroundStyle(calendarAccent)
                }
                Spacer()
                Button { moveMonth(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
            }.foregroundStyle(.primary)
            Picker("Mode de saisie", selection: $mode) {
                ForEach(ActivityMode.allCases) { item in Text(item.label).tag(item) }
            }.pickerStyle(.segmented).tint(calendarAccent)
            if mode == .commute {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Kilomètres supplémentaires").font(.caption.weight(.semibold))
                        Text("Déplacements pro hors trajet classique").font(.caption2).foregroundStyle(.secondary)
                    }
                    Spacer()
                    TextField("0", text: $mileageDraft).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                        .frame(width: 68).padding(10).background(DP.background(scheme), in: RoundedRectangle(cornerRadius: 12))
                    Button("OK") { saveMileage() }.font(.caption.bold()).foregroundStyle(calendarAccent)
                }.padding(13).background(DP.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            }
            calendarGrid(value)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 6) {
                calendarLegend("Déjà facturé", "checkmark.circle.fill", workColor)
                calendarLegend("À facturer", "clock", plannedColor)
                calendarLegend("Férié", "sun.max.fill", holidayColor)
                calendarLegend("Vacances", "beach.umbrella.fill", vacationColor)
                calendarLegend("Voiture", "car.fill", commuteColor,
                               detail: (value.expenses?.ikEur.euros ?? "—") + " · IK à date")
                calendarLegend("NDF", "receipt.fill", ndfColor,
                               detail: (value.expenses?.ndf.totalEur.euros ?? "—") + " TTC")
            }
            Text("Jours cochés : déjà facturés jusqu’à aujourd’hui inclus ; à facturer pour les dates à venir.")
                .font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)

        }
        }
    }
    private func calendarGrid(_ value: ActivityMonthResponse) -> some View {
        let leading = value.days.first.map { ($0.weekday + 6) % 7 } ?? 0
        let ndfByDay = Dictionary(grouping: value.expenses?.ndf.transactions ?? [], by: { String($0.date.prefix(10)) })
            .mapValues { rows in rows.reduce(0.0) { $0 + abs($1.amount) } }
        return VStack(spacing: 7) {
            HStack(spacing: 4) {
                ForEach(Array(["L", "M", "M", "J", "V", "S", "D"].enumerated()), id: \.offset) { _, day in
                    Text(day).font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 7), spacing: 3) {
                ForEach(0..<leading, id: \.self) { _ in Color.clear.frame(height: 40) }
                ForEach(value.days) { day in dayCell(day, today: value.today, ndfAmount: ndfByDay[day.iso]) }
            }
        }
    }
    private func dayCell(_ day: ActivityDay, today: String, ndfAmount: Double?) -> some View {
        let selected = mode == .worked ? day.worked : mode == .vacation ? day.vacation : day.commute
        let planned = day.iso > today
        let billingColor = planned ? plannedColor : workColor
        let color = mode == .worked ? billingColor : mode == .commute ? commuteColor : vacationColor
        let dayColor = day.worked ? billingColor : day.vacation ? vacationColor : day.holiday != nil ? holidayColor : day.commute ? commuteColor : ndfAmount != nil ? ndfColor : Color.primary
        let marked = day.worked || day.vacation || day.commute || day.holiday != nil || ndfAmount != nil
        return Button { Task { await toggle(day, selected: !selected) } } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(marked ? dayColor.opacity(scheme == .dark ? 0.20 : 0.10) : Color.primary.opacity(scheme == .dark ? 0.07 : 0.035))
                RoundedRectangle(cornerRadius: 9)
                    .stroke(day.iso == today ? calendarAccent : selected ? color.opacity(0.85) : Color.primary.opacity(0.14), lineWidth: day.iso == today ? 2 : 1)
                VStack(spacing: 1) {
                    if savingDate == day.iso { ProgressView().controlSize(.mini).frame(height: 17) }
                    else {
                        HStack(spacing: 2) {
                            Text("\(day.day)").font(.system(size: 14, weight: marked || day.iso == today ? .bold : .medium))
                                .foregroundStyle(Color.primary.opacity(day.billable || marked ? 1 : 0.65))
                            if ndfAmount != nil {
                                Image(systemName: "receipt.fill").font(.system(size: 8, weight: .semibold)).foregroundStyle(ndfColor)
                            }
                        }
                    }
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 2), GridItem(.flexible(), spacing: 2)], spacing: 2) {
                        dayMarker(planned ? "clock" : "checkmark.circle.fill", active: day.worked, color: billingColor)
                        dayMarker("sun.max.fill", active: day.holiday != nil, color: holidayColor)
                        dayMarker("beach.umbrella.fill", active: day.vacation, color: vacationColor)
                        dayMarker("car.fill", active: day.commute, color: commuteColor)
                    }.padding(.horizontal, 2)
                }
            }.frame(height: 40)
        }.buttonStyle(.plain).disabled(savingDate != nil)
            .accessibilityLabel(([dayLabel(day.iso), day.worked ? (planned ? "À facturer, jour planifié" : "Déjà facturé, jour réalisé") : nil,
                day.holiday.map { "Férié : " + $0 }, day.vacation ? "Vacances" : nil,
                day.commute ? "Voiture" : nil, ndfAmount.map { "Note de frais : " + $0.euros + " TTC" },
                day.iso == today ? "Aujourd’hui" : nil].compactMap { $0 }).joined(separator: ", "))
            .accessibilityHint("Modifier : " + mode.label)
    }
    private var calendarAccent: Color { DP.tint(scheme) }
    private var workColor: Color { scheme == .dark ? Color(hex: 0x6EE7B7) : Color(hex: 0x047857) }
    private var plannedColor: Color { scheme == .dark ? Color(hex: 0xFDBA74) : Color(hex: 0x9A3412) }
    private var holidayColor: Color { scheme == .dark ? Color(hex: 0xFCD34D) : Color(hex: 0x92400E) }
    private var vacationColor: Color { scheme == .dark ? Color(hex: 0x7DD3FC) : Color(hex: 0x0369A1) }
    private var commuteColor: Color { scheme == .dark ? Color(hex: 0xD8B4FE) : Color(hex: 0x7E22CE) }
    private var ndfColor: Color { scheme == .dark ? Color(hex: 0xF9A8D4) : Color(hex: 0x9D174D) }
    private func dayMarker(_ symbol: String, active: Bool, color: Color) -> some View {
        Image(systemName: symbol).font(.system(size: 8, weight: .bold))
            .foregroundStyle(color).opacity(active ? 1 : 0)
            .frame(maxWidth: .infinity).frame(height: 9).accessibilityHidden(true)
    }
    private func calendarLegend(_ text: String, _ symbol: String, _ color: Color, detail: String? = nil) -> some View {
        HStack(spacing: 7) {
            Image(systemName: symbol).foregroundStyle(color).frame(width: 18)
            VStack(alignment: .leading, spacing: 2) {
                Text(text).foregroundStyle(.primary)
                if let detail {
                    Text(detail).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                }
            }
        }.font(.caption.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
            .padding(7).background(color.opacity(scheme == .dark ? 0.14 : 0.08), in: RoundedRectangle(cornerRadius: 10))
    }
    private func activityExpenses(_ value: ActivityExpenses) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeading(title: "IK et notes de frais", subtitle: monthLabel(monthKey, abbreviated: false).capitalized + " · à date")
            DPCard {
                VStack(alignment: .leading, spacing: 12) {
                    MoneyRow(title: "IK générées", amount: value.ikEur, symbol: "car.fill", color: commuteColor)
                    Text("\(value.commuteDays) jours voiture · \(value.km.formatted(.number.precision(.fractionLength(0...1)))) km, kilomètres supplémentaires inclus")
                        .font(.caption).foregroundStyle(.secondary)
                    Text("Cumul annuel à cette période : \(value.ikYearToDateEur.euros)")
                        .font(.caption2).foregroundStyle(.secondary)
                    Divider()
                    MoneyRow(title: "NDF depuis le perso", amount: value.ndf.totalEur, symbol: "receipt", color: DP.amber)
                    Text("Notes de frais validées · TTC · après dédoublonnage")
                        .font(.caption2).foregroundStyle(.secondary)
                    if !value.ndf.transactions.isEmpty {
                        DisclosureGroup("Voir les \(value.ndf.transactions.count) opérations") {
                            ForEach(value.ndf.transactions) { row in
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(row.label).font(.caption).lineLimit(2)
                                        Text(dayLabel(row.date)).font(.caption2).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(abs(row.amount).euros).font(.caption.weight(.semibold))
                                }.padding(.vertical, 6)
                            }
                        }.font(.caption)
                    }
                }
            }
        }
    }
    private func monthIndicators(_ value: ActivityMonthResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeading(title: "Le mois en chiffres", subtitle: value.monthTitle)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], spacing: 12) {
                DPMetricTile(title: "Jours travaillés", value: "\(value.kpis.jours)", caption: "jours facturés", symbol: "calendar.badge.checkmark", color: DP.teal)
                DPMetricTile(title: "CA estimé", value: value.kpis.caEstime.euros, caption: "HT sécurisé", symbol: "checkmark.shield", color: DP.teal)
                DPMetricTile(title: "Reste à facturer", value: value.kpis.resteAFacturer.euros, caption: "capacité restante", symbol: "hourglass", color: DP.amber)
                DPMetricTile(title: "Projection mois", value: value.kpis.projectionFinMois.euros, caption: "à capacité complète", symbol: "scope", color: DP.blue)
            }
        }
    }
    private func historyCard(_ value: ActivityResponse) -> some View {
        let selected = value.history.first { $0.monthKey == selectedHistoryMonth } ?? value.history.last
        return DPCard {
            VStack(alignment: .leading, spacing: 17) {
                HStack { SectionHeading(title: "Jours facturés", subtitle: "Touchez une barre pour afficher son détail"); Spacer(); Image(systemName: "hand.tap").foregroundStyle(.secondary) }
                Chart(value.history) { row in
                    BarMark(x: .value("Mois", row.monthKey), y: .value("Jours", row.days), width: .ratio(0.65))
                        .foregroundStyle(historyColor(row.kind).gradient).cornerRadius(4)
                        .opacity(selectedHistoryMonth == nil || selectedHistoryMonth == row.monthKey ? 1 : 0.32)
                    if selectedHistoryMonth == row.monthKey { RuleMark(x: .value("Mois", row.monthKey)).foregroundStyle(.secondary.opacity(0.25)).lineStyle(StrokeStyle(dash: [3])) }
                }.chartXSelection(value: $selectedHistoryMonth)
                    .chartXAxis { AxisMarks(values: .automatic(desiredCount: 6)) { value in AxisValueLabel { if let key = value.as(String.self) { Text(monthLabel(key)).font(.system(size: 9)) } } } }
                    .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(.secondary.opacity(0.12)); AxisValueLabel() } }
                    .frame(height: 180)
                if let selected { historyDetail(selected) }
                HStack { legend("Encaissé", DP.teal); legend("Déjà facturé", DP.blue); legend("À facturer", DP.amber) }
            }
        }
    }
    private func historyDetail(_ row: ActivityHistoryMonth) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(monthLabel(row.monthKey, abbreviated: false).capitalized).font(.subheadline.weight(.semibold))
                    Text(historyStatus(row.kind)).font(.caption2).foregroundStyle(historyColor(row.kind))
                }
                Spacer()
                Button { selectedHistoryMonth = nil } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
            }
            HStack(spacing: 8) {
                historyValue("Jours", row.days.formatted(.number.precision(.fractionLength(0...1))) + " j")
                historyValue("TJM HT", row.tjmHt.euros)
                historyValue("Montant HT", row.caHt.euros)
            }
            if let plannedDays = row.plannedDays, let plannedCa = row.plannedCaHt {
                Text("Planifié : \(plannedDays.formatted(.number.precision(.fractionLength(0...1)))) jours · \(plannedCa.euros) HT")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }.padding(.top, 14)
            .overlay(alignment: .top) { Divider() }
    }
    private func historyValue(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased()).font(.system(size: 8, weight: .bold)).tracking(0.7).foregroundStyle(.secondary)
            Text(value).font(.system(size: 12, weight: .semibold, design: .rounded)).minimumScaleFactor(0.55).lineLimit(1)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
    private func performanceCard(_ value: ActivityResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: "Performance TJM", subtitle: "\(value.performance.year) · depuis janvier")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], spacing: 12) {
                    DPMetricTile(title: "TJM actuel", value: value.performance.currentTjmHt.euros, caption: "HT · mois en cours", symbol: "briefcase", color: DP.accent)
                    DPMetricTile(title: "TJM moyen", value: value.performance.averageTjmYtd.euros, caption: "pondéré YTD", symbol: "gauge", color: DP.blue)
                    DPMetricTile(title: "Meilleur mois", value: value.performance.bestMonth.tjmHt.euros, caption: value.performance.bestMonth.monthLabel, symbol: "arrow.up.right", color: DP.teal)
                    DPMetricTile(title: "Pire mois", value: value.performance.worstMonth.tjmHt.euros, caption: value.performance.worstMonth.monthLabel, symbol: "arrow.down.right", color: DP.rose)
                }
        }
    }
    private func legend(_ text: String, _ color: Color) -> some View {
        HStack(spacing: 4) { Circle().fill(color).frame(width: 6, height: 6); Text(text) }.font(.system(size: 9)).foregroundStyle(.secondary)
    }
    private func historyColor(_ kind: String) -> Color { kind == "encaisse" ? DP.teal : kind == "deja_facture" ? DP.blue : DP.amber }
    private func historyStatus(_ kind: String) -> String { kind == "encaisse" ? "Encaissé" : kind == "deja_facture" ? "Déjà facturé" : "À facturer" }
    private func moveMonth(_ delta: Int) { month = Calendar(identifier: .gregorian).date(byAdding: .month, value: delta, to: month) ?? month }
    private func refreshActivity() async {
        async let monthRefresh: Void = loadMonth(force: true)
        async let historyRefresh: Void = loadFull(force: true)
        _ = await (monthRefresh, historyRefresh)
    }
    private func loadFull(force: Bool = false) async {
        guard let api = store.api else { return }
        if loadingHistory && !force { return }
        if let cached = store.activitySummary {
            data = cached.value
            if !force && Date().timeIntervalSince(cached.fetchedAt) < 300 { return }
        }
        let requestedMonth = monthKey
        let identity = UUID(); historyRequestID = identity
        loadingHistory = true
        defer { if historyRequestID == identity { loadingHistory = false } }
        do {
            let result: ActivityResponse = try await api.get("activity", query: [URLQueryItem(name: "month", value: requestedMonth)])
            try Task.checkCancellation()
            guard store.signedIn, historyRequestID == identity else { return }
            data = result
            store.activitySummary = (result, Date())
            selectedHistoryMonth = selectedHistoryMonth ?? result.history.last?.monthKey
        } catch is CancellationError { }
        catch let failure as URLError where failure.code == .cancelled { }
        catch is CancellationError { }
        catch let failure as URLError where failure.code == .cancelled { }
        catch { self.error = error.localizedDescription; if case APIError.expired = error { await store.signOut() } }
    }
    private func applyMonth(_ value: ActivityMonthResponse) {
        monthData = value
        mileageDraft = value.mileageExtraKm > 0 ? value.mileageExtraKm.formatted(.number.precision(.fractionLength(0...1))) : ""
    }
    private func loadMonth(force: Bool = false) async {
        guard let api = store.api else { return }
        let requestedMonth = monthKey
        let identity = UUID(); monthRequestID = identity
        if let cached = store.activityMonths[requestedMonth] {
            applyMonth(cached.value)
            if !force && cached.value.expenses != nil && Date().timeIntervalSince(cached.fetchedAt) < 300 { loading = false; return }
        } else if monthData?.month != requestedMonth { monthData = nil }
        loading = true; error = nil
        defer { if monthRequestID == identity { loading = false } }
        do {
            let result: ActivityMonthResponse = try await api.get("activity/month", query: [URLQueryItem(name: "month", value: requestedMonth)])
            try Task.checkCancellation()
            guard requestedMonth == monthKey, monthRequestID == identity, store.signedIn else { return }
            store.activityMonths[requestedMonth] = (result, Date())
            applyMonth(result)
        } catch is CancellationError { }
        catch let failure as URLError where failure.code == .cancelled { }
        catch {
            guard monthRequestID == identity else { return }
            self.error = error.localizedDescription
            if case APIError.expired = error { await store.signOut() }
        }
    }
    private func toggle(_ day: ActivityDay, selected: Bool) async {
        guard let api = store.api else { return }
        savingDate = day.iso; error = nil
        defer { savingDate = nil }
        do {
            let _: ActivityMutationAck = try await api.put("activity", body: ActivityDayMutation(kind: mode.rawValue, date: day.iso, selected: selected))
            store.activityMonths.removeAll(); store.activitySummary = nil
            await loadMonth(force: true)
            Task {
                async let history: Void = loadFull(force: true)
                async let overview: Void = store.refresh()
                _ = await (history, overview)
            }
        } catch { self.error = error.localizedDescription }
    }
    private func saveMileage() {
        let value = Double(mileageDraft.replacingOccurrences(of: ",", with: ".")) ?? 0
        Task { await mutate(ActivityMileageMutation(month: monthKey, value: max(0, value))) }
    }
    private func mutate<Body: Encodable>(_ body: Body) async {
        guard let api = store.api else { return }
        do { let _: ActivityMutationAck = try await api.put("activity", body: body); store.activityMonths.removeAll(); store.activitySummary = nil; await refreshActivity() }
        catch { self.error = error.localizedDescription }
    }
}

private enum ActivityMode: String, CaseIterable, Identifiable {
    case worked = "work", commute, vacation
    var id: String { rawValue }
    var label: String { self == .worked ? "Facturé" : self == .commute ? "Voiture" : "Vacances" }
    var color: Color { self == .worked ? DP.accent : self == .commute ? Color(hex: 0xB4A3D5) : DP.blue }
}
private func displayActivityTimestamp(_ iso: String) -> String {
    let parser = ISO8601DateFormatter()
    guard let date = parser.date(from: iso) else { return iso }
    return date.formatted(date: .abbreviated, time: .shortened)
}
