import Foundation

struct Configuration {
    let supabaseURL: URL
    let supabaseKey: String
    let apiURL: URL

    static func load(bundle: Bundle = .main) throws -> Configuration {
        func value(_ key: String) throws -> String {
            guard let value = bundle.object(forInfoDictionaryKey: key) as? String,
                  !value.isEmpty, !value.contains("$(") else { throw ConfigurationError.missing }
            return value
        }
        func url(_ key: String) throws -> URL {
            guard let url = URL(string: try value(key)), url.scheme == "https", url.host != nil else {
                throw ConfigurationError.missing
            }
            return url
        }
        return try Configuration(supabaseURL: url("SUPABASE_URL"),
                                 supabaseKey: value("SUPABASE_ANON_KEY"), apiURL: url("DIGITPRO_API_URL"))
    }
}
enum ConfigurationError: LocalizedError {
    case missing
    var errorDescription: String? { "Configurez les adresses DigitPro et Supabase dans Local.xcconfig." }
}
