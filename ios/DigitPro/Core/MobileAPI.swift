import Foundation
import Supabase

enum APIError: LocalizedError {
    case expired, server(String), invalidResponse, unavailable, offline
    var errorDescription: String? {
        switch self {
        case .expired: "Session expirée. Reconnectez-vous."
        case .server(let message): message
        case .invalidResponse: "Une mise à jour de DigitPro est nécessaire pour charger vos données."
        case .unavailable: "Le service DigitPro est momentanément indisponible. Réessayez dans un instant."
        case .offline: "Connexion internet indisponible. Vérifiez votre réseau puis réessayez."
        }
    }
}
private struct APIFailure: Decodable { let error: String }

@MainActor
final class MobileAPI {
    let supabase: SupabaseClient
    private let baseURL: URL
    private let transport: URLSession
    init(configuration: Configuration) {
        supabase = SupabaseClient(supabaseURL: configuration.supabaseURL, supabaseKey: configuration.supabaseKey)
        baseURL = configuration.apiURL
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 45
        transport = URLSession(configuration: config)
    }
    func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        try await request(path, method: "GET", query: query, body: Optional<Data>.none)
    }
    func syncTransactions(scope: String) async throws {
        // La synchronisation peut durer plus longtemps que le geste de pull-to-refresh.
        // Elle doit continuer même si SwiftUI annule la tâche du contrôle Refreshable.
        let operation = Task.detached { @MainActor [self] in
            try await syncTransactionsRequest(scope: scope)
        }
        try await operation.value
    }
    private func syncTransactionsRequest(scope: String) async throws {
        struct SyncResult: Decodable { let inserted: Int; let merged: Int }
        let _: SyncResult = try await request("transactions/sync", method: "POST", query: [URLQueryItem(name: "scope", value: scope)], body: Optional<Data>.none)
    }
    func put<T: Decodable, Body: Encodable>(_ path: String, body: Body) async throws -> T {
        try await request(path, method: "PUT", body: try JSONEncoder().encode(body))
    }
    private func request<T: Decodable>(_ path: String, method: String,
                                       query: [URLQueryItem] = [], body: Data?) async throws -> T {
        let session = try await supabase.auth.session
        var components = URLComponents(url: baseURL.appendingPathComponent("api/mobile/v1/" + path), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        if path == "transactions/sync" { request.timeoutInterval = 300 }
        request.httpBody = body
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let data: Data
        let response: URLResponse
        do { (data, response) = try await transport.data(for: request) }
        catch let error as URLError where error.code == .notConnectedToInternet || error.code == .networkConnectionLost { throw APIError.offline }
        catch let error as URLError where error.code == .timedOut || error.code == .cannotConnectToHost { throw APIError.unavailable }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 404 { throw APIError.unavailable }
        if http.statusCode == 401 { throw APIError.expired }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server((try? JSONDecoder().decode(APIFailure.self, from: data).error) ?? "Serveur indisponible.")
        }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw APIError.invalidResponse }
    }
}
