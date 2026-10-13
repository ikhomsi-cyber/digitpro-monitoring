import SwiftUI

struct PiloteTravelCard: View {
    @Environment(\.colorScheme) private var scheme
    let travel: PiloteTravel
    @Binding var scope: String
    @Binding var year: String
    @State private var selected: String?
    private var entry: PiloteTravelEntry? { travel.entries.first { $0.id == selected } }
    var body: some View {
        DPCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack { SectionHeading(title: "Vos voyages"); Spacer(); Text("\(travel.countries.count) pays").font(.caption).foregroundStyle(.secondary) }
                Text(travel.total.euros).font(.system(size: 28, weight: .semibold, design: .rounded)).monospacedDigit()
                Picker("Période des voyages", selection: $scope) {
                    Text("Historique").tag("history"); Text("Année").tag("year"); Text("Période").tag("period")
                }.pickerStyle(.segmented)
                if scope == "year" {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) { ForEach(travel.years, id: \.self) { value in
                            Button { year = value } label: {
                                Text(value).font(.caption.weight(.semibold)).padding(.horizontal, 14).padding(.vertical, 10)
                                    .background(value == year ? DP.tint(scheme).opacity(0.15) : .secondary.opacity(0.06), in: Capsule())
                                    .overlay(Capsule().stroke(value == year ? DP.tint(scheme).opacity(0.5) : DP.border(scheme)))
                            }.buttonStyle(.plain).accessibilityAddTraits(value == year ? .isSelected : [])
                        } }
                    }
                }
                if !travel.countries.isEmpty {
                    NativePiloteMap(travel: travel, selected: $selected)
                    if let entry {
                        VStack(alignment: .leading, spacing: 10) {
                            MoneyRow(title: entry.subtitle, amount: entry.amount, color: DP.tint(scheme))
                            ForEach(Array(entry.posts.enumerated()), id: \.offset) { _, post in MoneyRow(title: post.name, amount: post.amount) }
                        }.padding(.vertical, 8)
                    }
                    ForEach(travel.entries) { item in
                        Button { withAnimation(.easeInOut(duration: 0.2)) { selected = selected == item.id ? nil : item.id } } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) { Text(item.name).font(.subheadline.weight(.medium)); Text(item.subtitle).font(.caption2).foregroundStyle(.secondary) }
                                Spacer()
                                Text(item.amount.euros).font(.subheadline.weight(.semibold)).monospacedDigit()
                                Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.secondary)
                            }.foregroundStyle(selected == item.id ? DP.tint(scheme) : .primary).padding(.vertical, 7)
                        }.buttonStyle(.plain)
                        if item.id != travel.entries.last?.id { Divider() }
                    }
                } else { Text("Aucune dépense de voyage sur cette période.").font(.subheadline).foregroundStyle(.secondary) }
                if !travel.shared.isEmpty {
                    DisclosureGroup("Destinations non identifiées") {
                        ForEach(travel.shared) { item in
                            DisclosureGroup { ForEach(item.posts) { post in MoneyRow(title: post.name, amount: post.amount) } } label: { MoneyRow(title: item.name, amount: item.amount) }.padding(.vertical, 8)
                        }
                    }.font(.caption)
                }
            }
        }.onChange(of: travel.year + travel.scope) { _, _ in selected = nil }
    }
}
private struct WorldShape: Decodable { let id, name, path: String }
private struct NativeRegion {
    let id: String
    let polygons: [[CGPoint]]
    let bounds: CGRect
    init(_ shape: WorldShape) {
        id = shape.id
        let expression = try! NSRegularExpression(pattern: "[MLZ]|-?[0-9]+(?:\\.[0-9]+)?")
        let tokens = expression.matches(in: shape.path, range: NSRange(shape.path.startIndex..., in: shape.path)).compactMap { Range($0.range, in: shape.path).map { String(shape.path[$0]) } }
        var rings: [[CGPoint]] = []; var ring: [CGPoint] = []; var i = 0
        while i < tokens.count {
            if tokens[i] == "M" { if !ring.isEmpty { rings.append(ring); ring = [] }; i += 1 }
            else if tokens[i] == "L" { i += 1 }
            else if tokens[i] == "Z" { if !ring.isEmpty { rings.append(ring); ring = [] }; i += 1 }
            else if i + 1 < tokens.count, let x = Double(tokens[i]), let y = Double(tokens[i+1]) { ring.append(CGPoint(x: x, y: y)); i += 2 }
            else { i += 1 }
        }
        if !ring.isEmpty { rings.append(ring) }; polygons = rings
        let boxes = rings.map { points -> CGRect in
            let xs = points.map(\.x), ys = points.map(\.y)
            return CGRect(x: xs.min() ?? 0, y: ys.min() ?? 0, width: (xs.max() ?? 0)-(xs.min() ?? 0), height: (ys.max() ?? 0)-(ys.min() ?? 0))
        }
        let main = boxes.max(by: { $0.width*$0.height < $1.width*$1.height }) ?? .zero
        bounds = boxes.filter { abs($0.midX-main.midX) < 50 && abs($0.midY-main.midY) < 50 }.reduce(CGRect.null) { $0.union($1) }
    }
}
private struct NativePiloteMap: View {
    @Environment(\.colorScheme) private var scheme
    let travel: PiloteTravel
    @Binding var selected: String?
    private static let regions: [NativeRegion] = {
        guard let url = Bundle.main.url(forResource: "world-shapes", withExtension: "json"), let data = try? Data(contentsOf: url), let shapes = try? JSONDecoder().decode([WorldShape].self, from: data) else { return [] }
        return shapes.map(NativeRegion.init)
    }()
    private var active: PiloteTravelEntry? { travel.entries.first { $0.id == selected } }
    private func bounds(_ id: String) -> CGRect {
        if let country = travel.countries.first(where: { $0.id == id }), country.places.count == 1 {
            switch country.places[0].name {
            case "Minorque": return CGRect(x: 367.606304, y: 99.841174, width: 1.06787, height: 0.525878)
            case "Tenerife": return CGRect(x: 326.167884, y: 122.833118, width: 1.596622, height: 1.17269)
            default: break
            }
        }
        if id == "MV" { return CGRect(x: 503, y: 169, width: 6, height: 6) }
        return Self.regions.first { $0.id == id }?.bounds ?? .zero
    }
    private var viewport: CGRect {
        let ids = active?.countryIds ?? travel.countries.map(\.id)
        let island = active?.countryIds.count == 1 && travel.countries.first(where: { $0.id == active?.countryIds.first })?.places.count == 1 && ["Minorque", "Tenerife"].contains(travel.countries.first(where: { $0.id == active?.countryIds.first })?.places.first?.name ?? "")
        // Use country bounds for the overview, then exact island bounds on selection.
        let combined = ids.map { id in active == nil ? Self.regions.first(where: { $0.id == id })?.bounds ?? bounds(id) : bounds(id) }.reduce(CGRect.null) { $0.union($1) }
        let height = max(island ? 1.5 : 24, combined.height*1.25, combined.width*1.25/2)
        return CGRect(x: combined.midX-height, y: combined.midY-height/2, width: height*2, height: height)
    }
    var body: some View {
        GeometryReader { proxy in
            let region = viewport
            let size = proxy.size
            let visited = Set(travel.countries.map(\.id))
            ZStack(alignment: .topTrailing) {
                Canvas { context, _ in
                    for country in Self.regions {
                        var path = Path()
                        for polygon in country.polygons {
                            for (index, point) in polygon.enumerated() {
                                let p = project(point, region, size)
                                if index == 0 { path.move(to: p) } else { path.addLine(to: p) }
                            }
                            path.closeSubpath()
                        }
                        context.fill(path, with: .color(visited.contains(country.id) ? DP.teal.opacity(0.65) : (scheme == .dark ? Color.white.opacity(0.08) : Color.gray.opacity(0.15))))
                        context.stroke(path, with: .color(visited.contains(country.id) ? DP.accent.opacity(0.5) : .secondary.opacity(0.16)), lineWidth: 0.5)
                    }
                }.accessibilityHidden(true)
                ForEach(travel.entries.filter { selected == nil || $0.id == selected }) { item in
                    let boxes = item.countryIds.map(bounds)
                    let center = CGPoint(x: boxes.map(\.midX).reduce(0,+)/CGFloat(max(1,boxes.count)), y: boxes.map(\.midY).reduce(0,+)/CGFloat(max(1,boxes.count)))
                    let anchor = project(center, region, size)
                    let label = CGPoint(x: max(34, min(size.width-34, project(CGPoint(x: boxes.map(\.minX).min() ?? center.x, y: center.y), region, size).x-34)), y: max(14, min(size.height-14, anchor.y)))
                    Path { path in path.move(to: anchor); path.addLine(to: label) }.stroke(DP.accent.opacity(0.6), lineWidth: 0.6).accessibilityHidden(true)
                    Circle().fill(DP.accent).frame(width: 3, height: 3).position(anchor).accessibilityHidden(true)
                    Button { withAnimation { selected = item.id } } label: {
                        Text(item.amount.euros).font(.system(size: 10, weight: .semibold)).monospacedDigit().padding(.horizontal, 7).padding(.vertical, 5)
                            .background(DP.surface(scheme).opacity(0.95), in: Capsule()).overlay(Capsule().stroke(DP.accent.opacity(0.45), lineWidth: 0.5))
                    }.buttonStyle(.plain).position(label).accessibilityLabel("\(item.name), \(item.amount.euros), voir le détail")
                }
                if selected != nil { Button("Tous les pays") { withAnimation { selected = nil } }.font(.caption2.weight(.medium)).padding(8).background(DP.surface(scheme).opacity(0.95), in: Capsule()).padding(10) }
            }.background(LinearGradient(colors: [DP.background(scheme), DP.surface(scheme).opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }.aspectRatio(2, contentMode: .fit)
    }
    private func project(_ point: CGPoint, _ region: CGRect, _ size: CGSize) -> CGPoint {
        CGPoint(x: (point.x-region.minX)/region.width*size.width, y: (point.y-region.minY)/region.height*size.height)
    }
}
