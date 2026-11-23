import Foundation
import Capacitor
import UserNotifications
import BackgroundTasks
import UIKit

/**
 * NoorayaAdhanPlugin (iOS / Swift)
 *
 * Implements offline, closed-app prayer notifications on iOS using `UNUserNotificationCenter`:
 * - Enforces iOS's 64 pending local notification hard cap (max 59 prayers + 1 Day-9 top-up reminder = 60).
 * - Uses authentic bundled <=28s Linear PCM `.wav` / `.caf` Adhan sound clips via `UNNotificationSound(named:)`,
 *   including a separate Fajr clip. If a clip file is missing from the bundle, sends a silent text notification
 *   (`content.sound = nil`) and NEVER plays a synthetic tone.
 * - Sets `interruptionLevel = .timeSensitive` (iOS 15+) so prayer alerts can break through Scheduled Summary
 *   and Focus modes when permitted by the user, without requesting Apple's restricted Critical Alerts entitlement.
 * - Registers a `BGAppRefreshTask` (`com.nooraya.quranaudio.refreshPrayers`) to top up the 10-day window
 *   in the background whenever iOS grants execution time.
 * - Note (honest iOS platform behavior): iOS caps local notification sounds at 30 seconds and mutes them when
 *   the hardware Silent switch or a disallowing Focus mode is enabled. Tapping the notification opens Nooraya
 *   to play the full 3–4 minute Muezzin Adhan.
 */
@objc(NoorayaAdhanPlugin)
public class NoorayaAdhanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NoorayaAdhanPlugin"
    public let jsName = "NoorayaAdhan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "schedulePrayerAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAllPrayerAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getReliabilityStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openNativeSetting", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "testNativeAdhanIn10Seconds", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopNativeAdhan", returnType: CAPPluginReturnPromise)
    ]

    private let maxPendingLimit = 60
    private let bgTaskId = "com.nooraya.quranaudio.refreshPrayers"
    private let defaultsKeyLastScheduled = "nooraya_ios_last_scheduled_iso"

    @objc func schedulePrayerAlarms(_ call: CAPPluginCall) {
        guard let alarms = call.getArray("alarms", JSObject.self) else {
            call.reject("Missing alarms array")
            return
        }

        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                call.reject("Notification authorization error: \(error.localizedDescription)")
                return
            }
            if !granted {
                call.resolve([
                    "scheduledCount": 0,
                    "exactAlarmUsed": false,
                    "error": "Notifications permission not granted on iOS."
                ])
                return
            }

            // Remove all previously scheduled Nooraya prayer alerts before scheduling fresh batch
            center.removeAllPendingNotificationRequests()

            let nowMs = Date().timeIntervalSince1970 * 1000.0
            let capped = Array(alarms.prefix(self.maxPendingLimit))
            var scheduledCount = 0
            let group = DispatchGroup()

            for item in capped {
                guard let id = item["id"] as? Int,
                      let fireAtMs = item["fireAtMs"] as? Double,
                      fireAtMs > nowMs + 5000.0 else { continue }

                let prayerKey = (item["prayerKey"] as? String) ?? "dhuhr"
                let title = (item["title"] as? String) ?? "It is time for Prayer"
                let body = (item["body"] as? String) ?? "Hayya 'ala-s-Salah"
                let fallbackSilent = (item["fallbackToSilentText"] as? Bool) ?? false
                let soundResource = item["nativeSoundResource"] as? String

                let content = UNMutableNotificationContent()
                content.title = title
                content.body = body
                content.userInfo = [
                    "prayerKey": prayerKey,
                    "url": "/dashboard/prayer-times?playAdhan=\(prayerKey)"
                ]

                if #available(iOS 15.0, *) {
                    content.interruptionLevel = (prayerKey == "top_up_reminder" || prayerKey == "sunrise")
                        ? .active
                        : .timeSensitive
                }

                // Attach real bundled <=28s Adhan clip if present; if missing, keep silent (never synthetic tone)
                if !fallbackSilent, let soundName = soundResource, self.bundleHasSound(named: soundName) {
                    content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: soundName))
                } else {
                    content.sound = nil
                }

                let fireDate = Date(timeIntervalSince1970: fireAtMs / 1000.0)
                let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: fireDate)
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                let request = UNNotificationRequest(identifier: "nooraya_prayer_\(id)", content: content, trigger: trigger)

                group.enter()
                center.add(request) { addErr in
                    if addErr == nil {
                        scheduledCount += 1
                    }
                    group.leave()
                }
            }

            group.notify(queue: .main) {
                UserDefaults.standard.set(ISO8601DateFormatter().string(from: Date()), forKey: self.defaultsKeyLastScheduled)
                self.scheduleBackgroundRefreshTask()
                call.resolve([
                    "scheduledCount": scheduledCount,
                    "exactAlarmUsed": true
                ])
            }
        }
    }

    @objc func cancelAllPrayerAlarms(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        call.resolve(["ok": true])
    }

    @objc func stopNativeAdhan(_ call: CAPPluginCall) {
        // Full Adhan in iOS plays inside the app's AVAudioSession; web/native player stops it directly.
        call.resolve(["ok": true])
    }

    @objc func testNativeAdhanIn10Seconds(_ call: CAPPluginCall) {
        guard let item = call.getObject("alarm") else {
            call.reject("Missing alarm payload")
            return
        }
        let center = UNUserNotificationCenter.current()
        let prayerKey = (item["prayerKey"] as? String) ?? "dhuhr"
        let title = (item["title"] as? String) ?? "Nooraya 10s Offline Adhan Test"
        let body = (item["body"] as? String) ?? "Tap to open Nooraya and listen to the full Muezzin Adhan."
        let soundResource = item["nativeSoundResource"] as? String

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.userInfo = ["prayerKey": prayerKey, "url": "/dashboard/prayer-times?playAdhan=\(prayerKey)"]
        if #available(iOS 15.0, *) {
            content.interruptionLevel = .timeSensitive
        }
        if let soundName = soundResource, bundleHasSound(named: soundName) {
            content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: soundName))
        } else {
            content.sound = nil
        }

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 10.0, repeats: false)
        let req = UNNotificationRequest(identifier: "nooraya_test_10s", content: content, trigger: trigger)
        center.add(req) { err in
            if let err = err {
                call.resolve(["ok": false, "error": err.localizedDescription])
            } else {
                call.resolve([
                    "ok": true,
                    "scheduledForMs": (Date().timeIntervalSince1970 + 10.0) * 1000.0
                ])
            }
        }
    }

    @objc func getReliabilityStatus(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            center.getPendingNotificationRequests { pending in
                var timeSensitiveOk = false
                if #available(iOS 15.0, *) {
                    timeSensitiveOk = settings.timeSensitiveSetting == .enabled
                }
                let authorized = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
                call.resolve([
                    "notificationsGranted": authorized,
                    "canScheduleExactAlarms": authorized,
                    "batteryOptimizationIgnored": true,
                    "oemManufacturer": "APPLE",
                    "oemRequiresAutostartStep": false,
                    "channelSoundConfigured": settings.soundSetting == .enabled,
                    "dndInterruptsAllowed": timeSensitiveOk,
                    "iosTimeSensitiveAllowed": timeSensitiveOk,
                    "iosPendingCount": pending.count,
                    "iosMaxPending": 64,
                    "lastScheduledAtIso": UserDefaults.standard.string(forKey: self.defaultsKeyLastScheduled) as Any
                ])
            }
        }
    }

    @objc func openNativeSetting(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString),
                  UIApplication.shared.canOpenURL(url) else {
                call.resolve(["opened": false])
                return
            }
            UIApplication.shared.open(url, options: [:]) { success in
                call.resolve(["opened": success])
            }
        }
    }

    private func bundleHasSound(named fileName: String) -> Bool {
        let ns = fileName as NSString
        let ext = ns.pathExtension
        let name = ns.deletingPathExtension
        if Bundle.main.url(forResource: name, withExtension: ext) != nil {
            return true
        }
        if Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "Sounds") != nil {
            return true
        }
        return false
    }

    private func scheduleBackgroundRefreshTask() {
        let request = BGAppRefreshTaskRequest(identifier: bgTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 12 * 3600)
        try? BGTaskScheduler.shared.submit(request)
    }
}
