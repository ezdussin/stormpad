import SwiftUI
import WidgetKit

struct MemoriesEntry: TimelineEntry {
    let date: Date
    let snapshot: MemoriesWidgetSnapshot
    let smallIndex: Int
}

struct MemoriesProvider: TimelineProvider {
    func placeholder(in context: Context) -> MemoriesEntry {
        MemoriesEntry(
            date: Date(),
            snapshot: MemoriesWidgetSnapshot(
                updatedAt: 0,
                items: [
                    MemoryWidgetItem(
                        id: "1",
                        path: "memories/sample.md",
                        body: "Uma lembrança de exemplo no Stormpad.",
                        pinned: true,
                        listId: "inbox",
                        listName: "Entrada",
                        createdAt: 0
                    )
                ]
            ),
            smallIndex: 0
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (MemoriesEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MemoriesEntry>) -> Void) {
        let entry = currentEntry()
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
    }

    private func currentEntry() -> MemoriesEntry {
        let snapshot = MemoriesWidgetSnapshot.load()
        let index = StormpadAppGroup.defaults?.integer(forKey: StormpadAppGroup.smallIndexKey) ?? 0
        let safeIndex = snapshot.items.isEmpty ? 0 : index % snapshot.items.count
        return MemoriesEntry(date: Date(), snapshot: snapshot, smallIndex: safeIndex)
    }
}

struct StormpadMemoriesWidget: Widget {
    static let kind = "StormpadMemoriesWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: MemoriesProvider()) { entry in
            MemoriesWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Color(red: 0.09, green: 0.09, blue: 0.11)
                }
        }
        .configurationDisplayName("Lembranças")
        .description("Blocos de lembranças do Stormpad.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct MemoriesWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: MemoriesEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallMemoryView(entry: entry)
        default:
            MemoryListView(entry: entry, compact: family == .systemMedium)
        }
    }
}

private struct SmallMemoryView: View {
    let entry: MemoriesEntry

    private var item: MemoryWidgetItem? {
        guard !entry.snapshot.items.isEmpty else { return nil }
        return entry.snapshot.items[entry.smallIndex % entry.snapshot.items.count]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Stormpad")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color(white: 0.7))
                Spacer()
                if let item, item.pinned {
                    Image(systemName: "pin.fill")
                        .font(.caption2)
                        .foregroundStyle(Color(red: 0.22, green: 0.66, blue: 0.86))
                }
            }

            if let item {
                Link(destination: URL(string: "stormpad://memories?id=\(item.id)")!) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.body)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.white)
                            .lineLimit(5)
                        Text(item.listName)
                            .font(.caption2)
                            .foregroundStyle(Color(white: 0.55))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }

                if #available(iOS 17.0, *) {
                    HStack {
                        Button(intent: PreviousMemoryIntent()) {
                            Image(systemName: "chevron.left")
                        }
                        .buttonStyle(.plain)
                        Spacer()
                        Text("\(entry.smallIndex + 1)/\(entry.snapshot.items.count)")
                            .font(.caption2)
                            .foregroundStyle(Color(white: 0.45))
                        Spacer()
                        Button(intent: NextMemoryIntent()) {
                            Image(systemName: "chevron.right")
                        }
                        .buttonStyle(.plain)
                    }
                    .foregroundStyle(Color(white: 0.75))
                }
            } else {
                Text("Nenhuma lembrança ainda.")
                    .font(.subheadline)
                    .foregroundStyle(Color(white: 0.55))
                Spacer()
            }
        }
        .padding(4)
    }
}

private struct MemoryListView: View {
    let entry: MemoriesEntry
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Lembranças")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.white)
                Spacer()
                Text("Stormpad")
                    .font(.caption2)
                    .foregroundStyle(Color(white: 0.55))
            }
            .padding(.horizontal, 4)

            if entry.snapshot.items.isEmpty {
                Text("Nenhuma lembrança ainda.")
                    .font(.subheadline)
                    .foregroundStyle(Color(white: 0.55))
                    .padding(4)
                Spacer()
            } else {
                List {
                    ForEach(entry.snapshot.items) { item in
                        Link(destination: URL(string: "stormpad://memories?id=\(item.id)")!) {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 4) {
                                    if item.pinned {
                                        Image(systemName: "pin.fill")
                                            .font(.caption2)
                                            .foregroundStyle(Color(red: 0.22, green: 0.66, blue: 0.86))
                                    }
                                    Text(item.listName)
                                        .font(.caption2)
                                        .foregroundStyle(Color(white: 0.5))
                                }
                                Text(item.body)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(Color.white)
                                    .lineLimit(compact ? 2 : 3)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 2)
                        }
                        .listRowBackground(Color.white.opacity(0.06))
                        .listRowInsets(EdgeInsets(top: 6, leading: 8, bottom: 6, trailing: 8))
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .padding(4)
    }
}
