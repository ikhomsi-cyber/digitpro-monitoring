import SwiftUI
import Charts
import UserNotifications

struct ForecastView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        PageScroll {
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "Une longueur d’avance")
                Text("Prévisionnel").font(.system(.largeTitle, design: .rounded, weight: .semibold)).tracking(-1)
                Text("Anticipez votre année en toute clarté.").font(.subheadline).foregroundStyle(.secondary)
            }
            if let data = store.overview {
                if let error = store.overviewError { InlineError(message: error) { Task { await store.refresh() } } }
                DPCard {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack { Eyebrow(text: "Cap au 31 décembre \(String(data.forecast.year))"); Spacer(); Image(systemName: "sparkles").foregroundStyle(DP.tint(scheme)) }
                        Text(data.forecast.projectedRevenueHtEur.euros).font(.system(size: 39, weight: .semibold, design: .rounded)).tracking(-1.4).minimumScaleFactor(0.5).lineLimit(1)
                        Text("Chiffre d’affaires prévisionnel HT").font(.subheadline).foregroundStyle(.secondary)
                        HStack { Pill(text: "Confiance \(data.forecast.confidence.label.lowercased())", color: DP.tint(scheme)); Spacer(); Text("\(data.forecast.confidence.score) %").font(.caption.weight(.semibold)).monospacedDigit() }
                        ProgressView(value: Double(data.forecast.confidence.score), total: 100).tint(DP.tint(scheme))
                    }
                }
                DPCard {
                    VStack(alignment: .leading, spacing: 20) {
                        SectionHeading(title: "La trajectoire de votre année", subtitle: "Encaissements réels et jours cochés × TJM · HT")
                        Chart(data.forecast.monthlySeries) { month in
                            BarMark(x: .value("Mois", month.monthKey), y: .value("CA HT", month.revenueHt), width: .ratio(0.65))
                                .foregroundStyle(by: .value("Type", month.kind == "actual" ? "Réel" : "Prévisionnel"))
                                .cornerRadius(3)
                                .accessibilityLabel("\(monthLabel(month.monthKey)), \(month.kind == "actual" ? "réel" : "prévisionnel")")
                                .accessibilityValue(month.revenueHt.euros)
                        }.chartForegroundStyleScale(["Réel": DP.tint(scheme), "Prévisionnel": DP.blue.opacity(0.5)])
                            .chartXAxis { AxisMarks(values: .automatic(desiredCount: 6)) { value in AxisValueLabel { if let month = value.as(String.self) { Text(monthLabel(month)).font(.system(size: 9)) } } } }
                            .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in AxisGridLine().foregroundStyle(.secondary.opacity(0.12)); AxisValueLabel { if let number = value.as(Double.self) { Text(number.formatted(.number.notation(.compactName))).font(.system(size: 9)) } } } }
                            .frame(height: 205)
                        Text(data.forecast.detail.basisLabel).font(.caption).foregroundStyle(.secondary)
                    }
                }
                SectionHeading(title: "Ce que l’année vous réserve", subtitle: "BNC déjà versé et solde prévisionnel au 31 décembre")
                DPCard {
                    VStack(spacing: 6) {
                        MoneyRow(title: "Revenus personnels", amount: data.cashForecast?.bncPaidYtdEur, symbol: "person.crop.circle", color: DP.tint(scheme))
                        Text("BNC réellement versé depuis le 1er janvier").font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                        Divider()
                        MoneyRow(title: "Trésorerie de fin d’année", amount: data.cashForecast?.projectedBalanceEur, symbol: "building.columns", color: DP.blue)
                        if let forecast = data.cashForecast {
                            Divider()
                            MoneyRow(title: "À encaisser d’ici le 31/12 · TTC", amount: forecast.expectedReceiptsTtcEur)
                            if let receipts = forecast.receiptSchedule, !receipts.isEmpty {
                                DisclosureGroup("Échéances prises en compte") {
                                    ForEach(Array(receipts.enumerated()), id: \.offset) { _, receipt in
                                        HStack {
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(dayLabel(receipt.date)).font(.caption.weight(.medium))
                                                Text(receipt.source == "invoice" ? "Facture Hiway restant à régler" : "Prévision selon les jours cochés").font(.caption2).foregroundStyle(.secondary)
                                            }
                                            Spacer()
                                            Text(receipt.amountTtcEur.euros).font(.caption.weight(.semibold))
                                        }.padding(.vertical, 5)
                                    }
                                }.font(.caption).padding(.vertical, 6)
                            }
                            MoneyRow(title: "Sorties estimées · TTC", amount: forecast.expectedExpensesTtcEur)
                            Text(forecast.basis).font(.caption2).foregroundStyle(.secondary).padding(.top, 8)
                        }

                    }
                }
                SectionHeading(title: "Vos versements", subtitle: monthLabel(data.month, abbreviated: false).capitalized)
                DPCard {
                    VStack(spacing: 8) {
                        HStack { Text("Total versé").font(.headline); Spacer(); Text(data.treasury.verseCeMois.euros).font(.system(.title2, design: .rounded, weight: .semibold)).foregroundStyle(DP.tint(scheme)) }
                        Divider().padding(.vertical, 5)
                        MoneyRow(title: "Rémunération BNC", amount: data.treasury.bncMois)
                        MoneyRow(title: "Indemnités kilométriques", amount: data.treasury.ikMois)
                        MoneyRow(title: "Notes de frais · repas d’affaire", amount: data.treasury.ndfMois)
                    }
                }
                Text("Les projections évoluent avec votre activité. Trésorerie calculée à partir du dernier solde importé.")
                    .font(.caption2).foregroundStyle(.secondary)
            } else { LoadingOverview() }
        }.toolbar(.hidden, for: .navigationBar).refreshable { await store.refresh() }
    }
}
struct FinanceView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var section = 0
    var body: some View {
        PageScroll {
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "Une vision d’ensemble")
                Text("Patrimoine").font(.system(.largeTitle, design: .rounded, weight: .semibold)).tracking(-1)
                Text("Immobilier, frais et sérénité fiscale.").font(.subheadline).foregroundStyle(.secondary)
            }
            Picker("Analyse", selection: $section) { Text("LMNP").tag(0); Text("Notes de frais").tag(1); Text("Fiscalité").tag(2) }.pickerStyle(.segmented)
            if let data = store.overview {
                if let error = store.overviewError { InlineError(message: error) { Task { await store.refresh() } } }
                if section == 0 { property(data) }
                else if section == 1 { expenses(data) }
                else { taxes(data) }
            } else { LoadingOverview() }
        }.toolbar(.hidden, for: .navigationBar).refreshable { await store.refresh() }
    }
    private func property(_ data: Overview) -> some View {
        VStack(spacing: 22) {
            DPCard {
                VStack(alignment: .leading, spacing: 20) {
                    HStack { SymbolBadge(symbol: "building.2", color: DP.blue); SectionHeading(title: "Votre investissement locatif", subtitle: "Location meublée · historique chargé"); Spacer() }
                    Eyebrow(text: "Revenu locatif net")
                    Text(data.lmnp.revenuNet.euros).font(.system(size: 38, weight: .semibold, design: .rounded)).tracking(-1.2)
                    if let rate = data.lmnp.rentabiliteNettePct {
                        Pill(text: "\(rate.formatted(.number.precision(.fractionLength(1)))) % de rentabilité nette", symbol: "chart.line.uptrend.xyaxis", color: DP.tint(scheme))
                    }
                    Divider()
                    MoneyRow(title: "Prix d’acquisition", amount: data.lmnp.purchasePriceEur)
                    MoneyRow(title: "Loyers encaissés", amount: data.lmnp.totalLoyers)
                    MoneyRow(title: "Charges cumulées", amount: data.lmnp.totalDepenses)
                }
            }
            DPCard {
                VStack(alignment: .leading, spacing: 16) {
                    SectionHeading(title: "Revenus mois par mois", subtitle: "Douze derniers mois disponibles · nets")
                    if data.lmnp.months.isEmpty { Text("Vos loyers apparaîtront ici après leur import.").font(.subheadline).foregroundStyle(.secondary) }
                    else {
                        Chart(Array(data.lmnp.months.suffix(12))) { month in
                            BarMark(x: .value("Mois", month.month), y: .value("Revenu net", month.net)).foregroundStyle(DP.blue.gradient).cornerRadius(3)
                        }.chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { value in AxisValueLabel { if let month = value.as(String.self) { Text(monthLabel(month)).font(.caption2) } } } }.frame(height: 170)
                        NavigationLink {
                            PageScroll { ForEach(data.lmnp.months.reversed()) { month in DPCard { MoneyRow(title: monthLabel(month.month, abbreviated: false).capitalized, amount: month.net) } } }
                                .navigationTitle("Historique LMNP").navigationBarTitleDisplayMode(.inline)
                        } label: { HStack { Text("Tout l’historique"); Spacer(); Image(systemName: "arrow.up.right") }.font(.subheadline.weight(.semibold)) }
                    }
                }
            }
        }
    }
    private func expenses(_ data: Overview) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            DPCard {
                VStack(alignment: .leading, spacing: 17) {
                    HStack { SymbolBadge(symbol: "receipt", color: DP.amber); SectionHeading(title: "Notes de frais validées", subtitle: monthLabel(data.month, abbreviated: false).capitalized) }
                    Text(data.ndf.totalEur.euros).font(.system(size: 40, weight: .semibold, design: .rounded)).tracking(-1)
                    Pill(text: "Total TTC · après dédoublonnage", symbol: "checkmark.circle", color: DP.tint(scheme))
                }
            }
            if data.ndf.transactions.isEmpty {
                ContentUnavailableView("Tout est à jour", systemImage: "checkmark.seal", description: Text("Aucune note de frais validée pour ce mois."))
            } else {
                SectionHeading(title: "Le détail de vos frais")
                DPCard {
                    VStack(spacing: 16) {
                        ForEach(data.ndf.transactions) { row in
                            HStack(spacing: 12) {
                                SymbolBadge(symbol: "receipt", color: DP.amber)
                                VStack(alignment: .leading, spacing: 5) { Text(row.label).font(.subheadline.weight(.medium)); Text(dayLabel(row.date)).font(.caption2).foregroundStyle(.secondary) }
                                Spacer(); Text(abs(row.amount).euros).font(.system(.subheadline, design: .rounded, weight: .semibold))
                            }
                        }
                    }
                }
            }
        }
    }
    private func taxes(_ data: Overview) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            DPCard {
                VStack(alignment: .leading, spacing: 18) {
                    HStack { Eyebrow(text: "Provisions fiscales cumulées"); Spacer(); Image(systemName: "shield.lefthalf.filled").foregroundStyle(DP.amber) }
                    Text(data.dashboard.detteTotaleDepuisDebutEur.euros).font(.system(size: 40, weight: .semibold, design: .rounded)).tracking(-1)
                    Text("Anticiper aujourd’hui, avancer sereinement.").font(.subheadline).foregroundStyle(.secondary)
                    Divider()
                    MoneyRow(title: "TVA restante", amount: data.dashboard.detteTvaDepuisDebutEur, symbol: "percent", color: DP.blue)
                    MoneyRow(title: "CSG restante", amount: data.dashboard.detteCsgDepuisDebutEur, symbol: "shield", color: DP.amber)
                }
            }
            DPCard {
                VStack(alignment: .leading, spacing: 15) {
                    SectionHeading(title: "Votre couverture de trésorerie")
                    if let balance = data.dashboard.soldeQontoEur {
                        let coverage = data.dashboard.detteTotaleDepuisDebutEur > 0 ? min(1, max(0, balance) / data.dashboard.detteTotaleDepuisDebutEur) : 1
                        ProgressView(value: coverage).tint(DP.tint(scheme))
                        MoneyRow(title: "Solde importé disponible", amount: balance)
                        MoneyRow(title: "Reste à couvrir", amount: data.dashboard.resteAVerserApresCashEur)
                    } else { Text("Importez un solde bancaire pour connaître votre couverture.").font(.subheadline).foregroundStyle(.secondary) }
                }
            }
            Label("Estimations issues des règles du Dashboard DigitPro. Elles ne constituent pas une déclaration fiscale.", systemImage: "info.circle")
                .font(.caption2).foregroundStyle(.secondary)
        }
    }
}
struct SettingsView: View {
    @AppStorage("digitpro.colorTheme") private var colorTheme = "emerald"
    @EnvironmentObject private var store: AppStore
    @AppStorage("digitpro.appearance") private var appearance = "dark"
    @Environment(\.colorScheme) private var scheme
    @State private var reminderMessage: String?
    var body: some View {
        PageScroll {
            VStack(alignment: .leading, spacing: 8) { Eyebrow(text: "Un espace à votre image"); Text("Réglages").font(.system(.largeTitle, design: .rounded, weight: .semibold)).tracking(-1) }
            DPCard {
                HStack(spacing: 15) { BrandMark(size: 52); VStack(alignment: .leading, spacing: 5) { Text("DigitPro").font(.title2.weight(.semibold)); Text("Votre espace personnel").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "checkmark.shield").foregroundStyle(DP.tint(scheme)) }
            }
            SectionHeading(title: "Apparence")
            DPCard { Picker("Thème", selection: $appearance) { Text("Sombre").tag("dark"); Text("Clair").tag("light"); Text("Système").tag("system") }.pickerStyle(.segmented) }
            DPCard {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeading(title: "Couleur", subtitle: "Votre signature DigitPro")
                    Picker("Couleur", selection: $colorTheme) {
                        Text("Émeraude").tag("emerald")
                        Text("Gris perle").tag("pearl")
                        Text("Obsidienne").tag("obsidian")
                    }.pickerStyle(.segmented)
                    if colorTheme == "obsidian" {
                        HStack(spacing: 12) {
                            Image(systemName: "moon.stars.fill").foregroundStyle(DP.accent)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Obsidienne").font(.subheadline.weight(.semibold))
                                Text("Noir profond, graphite et champagne. Ce thème utilise toujours le mode sombre.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }.padding(.vertical, 6)
                    }
                }
            }
            SectionHeading(title: "Confidentialité")
            DPCard {
                VStack(alignment: .leading, spacing: 18) {
                    Toggle(isOn: Binding(get: { store.faceID }, set: { value in Task { await store.setFaceID(value) } })) { Label("Face ID / code iPhone", systemImage: "faceid").font(.subheadline) }
                    Divider()
                    Toggle(isOn: Binding(get: { store.widgetEnabled }, set: { store.setWidget($0) })) { Label("Résumé mensuel dans le widget", systemImage: "rectangle.on.rectangle").font(.subheadline) }.disabled(store.faceID)
                    Text("Le widget est désactivé lorsque le verrouillage est actif. Les montants expirent après 24 heures.").font(.caption2).foregroundStyle(.secondary)
                }
            }
            SectionHeading(title: "Votre rendez-vous hebdomadaire")
            DPCard {
                VStack(alignment: .leading, spacing: 16) {
                    HStack { SymbolBadge(symbol: "bell.badge", color: DP.amber); SectionHeading(title: "Le point du lundi", subtitle: "Un rappel discret, chaque lundi à 9 h") }
                    Button("Activer mon rappel") { Task { await store.enableReminder(); if store.error == nil { reminderMessage = "Votre rendez-vous du lundi est activé." } } }.buttonStyle(PrimaryButtonStyle())
                    Button("Désactiver le rappel") { UNUserNotificationCenter.current().removeAllPendingNotificationRequests(); reminderMessage = "Rappel désactivé." }.font(.caption).frame(maxWidth: .infinity)
                    if let reminderMessage { Text(reminderMessage).font(.caption).foregroundStyle(DP.tint(scheme)) }
                }
            }
            Button(role: .destructive) { Task { await store.signOut() } } label: { Label("Se déconnecter", systemImage: "rectangle.portrait.and.arrow.right").font(.subheadline.weight(.medium)).frame(maxWidth: .infinity).padding(16) }
            Text("DigitPro pour iOS · Version 1.0").font(.caption2).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        }.toolbar(.hidden, for: .navigationBar)
    }
}
