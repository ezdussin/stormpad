import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setMemories", returnType: CAPPluginReturnPromise)
    ]

    private let appGroupId = "group.com.ezdussin.stormpad"
    private let snapshotKey = "memoriesSnapshot"

    @objc func setMemories(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("Missing json")
            return
        }

        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("App Group \(appGroupId) is not available. Enable it for the App target in Xcode.")
            return
        }

        defaults.set(json, forKey: snapshotKey)
        defaults.synchronize()

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve()
    }
}
