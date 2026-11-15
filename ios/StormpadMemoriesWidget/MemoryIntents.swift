import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct NextMemoryIntent: AppIntent {
    static var title: LocalizedStringResource = "Próxima lembrança"

    func perform() async throws -> some IntentResult {
        let snapshot = MemoriesWidgetSnapshot.load()
        guard !snapshot.items.isEmpty else { return .result() }
        let defaults = StormpadAppGroup.defaults
        let current = defaults?.integer(forKey: StormpadAppGroup.smallIndexKey) ?? 0
        let next = (current + 1) % snapshot.items.count
        defaults?.set(next, forKey: StormpadAppGroup.smallIndexKey)
        WidgetCenter.shared.reloadTimelines(ofKind: StormpadMemoriesWidget.kind)
        return .result()
    }
}

@available(iOS 17.0, *)
struct PreviousMemoryIntent: AppIntent {
    static var title: LocalizedStringResource = "Lembrança anterior"

    func perform() async throws -> some IntentResult {
        let snapshot = MemoriesWidgetSnapshot.load()
        guard !snapshot.items.isEmpty else { return .result() }
        let defaults = StormpadAppGroup.defaults
        let current = defaults?.integer(forKey: StormpadAppGroup.smallIndexKey) ?? 0
        let previous = (current - 1 + snapshot.items.count) % snapshot.items.count
        defaults?.set(previous, forKey: StormpadAppGroup.smallIndexKey)
        WidgetCenter.shared.reloadTimelines(ofKind: StormpadMemoriesWidget.kind)
        return .result()
    }
}
