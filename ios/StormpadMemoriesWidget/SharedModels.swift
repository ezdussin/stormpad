import Foundation

enum StormpadAppGroup {
    static let id = "group.com.ezdussin.stormpad"
    static let snapshotKey = "memoriesSnapshot"
    static let smallIndexKey = "memoriesWidgetSmallIndex"

    static var defaults: UserDefaults? {
        UserDefaults(suiteName: id)
    }
}

struct MemoryWidgetItem: Codable, Identifiable, Hashable {
    let id: String
    let path: String
    let body: String
    let pinned: Bool
    let listId: String?
    let listName: String
    let createdAt: Double
}

struct MemoriesWidgetSnapshot: Codable {
    let updatedAt: Double
    let items: [MemoryWidgetItem]

    static var empty: MemoriesWidgetSnapshot {
        MemoriesWidgetSnapshot(updatedAt: 0, items: [])
    }

    static func load() -> MemoriesWidgetSnapshot {
        guard
            let defaults = StormpadAppGroup.defaults,
            let json = defaults.string(forKey: StormpadAppGroup.snapshotKey),
            let data = json.data(using: .utf8),
            let snapshot = try? JSONDecoder().decode(MemoriesWidgetSnapshot.self, from: data)
        else {
            return .empty
        }
        return snapshot
    }
}
