import Foundation
struct PiloteResponse: Decodable {
    let version: Int
    let months: [String]
    let years: [String]
    let period: String?
    let views: [String]
    let summary: PiloteSummary?
    let families: [PiloteFamily]
    let categories: [PiloteGroup]
    let incomeCategories: [PiloteGroup]
    let travel: PiloteTravel
}
struct PiloteSummary: Decodable { let income, expenses, balance: Double; let coveragePercent: Int }
struct PiloteGroup: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let expenses, income: Double
    let count: Int
    let children: [PiloteGroup]
}
struct PiloteFamily: Decodable, Identifiable {
    let id, name, source: String
    let income, expenses, covered, balance, moroccoIncome, withoutMoroccoBalance: Double
    let expenseRows, incomeRows: [PiloteDetail]
}
struct PiloteDetail: Decodable, Identifiable {
    var id: String { (parent ?? "") + "|" + name }
    let parent: String?
    let name: String
    let amount: Double
}
struct PiloteTravel: Decodable {
    let total: Double
    let countries: [PiloteCountry]
    let entries: [PiloteTravelEntry]
    let shared: [PiloteSharedTravel]
    let scope, year: String
    let years: [String]
}
struct PiloteCountry: Decodable, Identifiable {
    let id, name: String
    let amount: Double
    let places: [PilotePlace]
}
struct PilotePlace: Decodable { let name: String; let amount: Double }
struct PiloteTravelEntry: Decodable, Identifiable {
    let id, name, subtitle: String
    let amount: Double
    let countryIds: [String]
    let posts: [PiloteDetail]
}
struct PiloteSharedTravel: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let amount: Double
    let posts: [PiloteDetail]
}
