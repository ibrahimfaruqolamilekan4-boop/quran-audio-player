package com.nooraya.quranaudio.adhan

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * NoorayaAdhanPlugin (Android / Kotlin)
 *
 * Schedules up to 10 days of exact offline prayer alarms via AlarmManager.setAlarmClock
 * (surviving Doze mode when SCHEDULE_EXACT_ALARM is granted), manages per-prayer
 * NotificationChannels with real bundled Muezzin audio clips, and provides the
 * Adhan Reliability Check status & OEM Autostart settings deep-links (Tecno, Infinix,
 * Xiaomi, Samsung, Oppo, Vivo).
 */
@CapacitorPlugin(name = "NoorayaAdhan")
class NoorayaAdhanPlugin : Plugin() {

    companion object {
        const val PREFS_NAME = "nooraya_offline_adhan_prefs"
        const val KEY_SCHEDULE_JSON = "scheduled_alarms_json"
        const val KEY_LAST_SCHEDULED_AT = "last_scheduled_at_iso"
        const val KEY_LAST_BOOT_RESCHEDULE_AT = "last_boot_reschedule_at_iso"

        fun channelIdForPrayer(prayerKey: String): String = "nooraya_prayer_${prayerKey.lowercase()}"

        fun ensurePrayerChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val prayers = listOf(
                Triple("fajr", "Fajr Adhan", "madinah_fajr_bukhari_28s"),
                Triple("dhuhr", "Dhuhr Adhan", "madinah_standard_28s"),
                Triple("asr", "Asr Adhan", "madinah_standard_28s"),
                Triple("maghrib", "Maghrib Adhan", "madinah_standard_28s"),
                Triple("isha", "Isha Adhan", "madinah_standard_28s"),
                Triple("sunrise", "Sunrise Reminder", null),
                Triple("top_up_reminder", "Schedule Refresh Reminder", null)
            )

            val audioAttrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            for ((key, label, rawResName) in prayers) {
                val chId = channelIdForPrayer(key)
                if (nm.getNotificationChannel(chId) != null) continue
                val importance = if (key == "sunrise" || key == "top_up_reminder") {
                    NotificationManager.IMPORTANCE_DEFAULT
                } else {
                    NotificationManager.IMPORTANCE_HIGH
                }
                val ch = NotificationChannel(chId, label, importance).apply {
                    description = "Offline prayer alert and real Muezzin Adhan channel for $label."
                    enableVibration(key != "sunrise")
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    if (rawResName != null) {
                        val resId = context.resources.getIdentifier(rawResName, "raw", context.packageName)
                        if (resId != 0) {
                            val soundUri = Uri.parse("android.resource://${context.packageName}/$resId")
                            setSound(soundUri, audioAttrs)
                        } else {
                            // Never fall back to a synthetic tone; leave silent if asset missing
                            setSound(null, null)
                        }
                    } else {
                        setSound(null, null)
                    }
                }
                nm.createNotificationChannel(ch)
            }
        }

        fun scheduleAlarmsFromJson(context: Context, alarmsJson: String): Pair<Int, Boolean> {
            ensurePrayerChannels(context)
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarmManager.canScheduleExactAlarms()
            } else {
                true
            }

            val arr = JSONArray(alarmsJson)
            val nowMs = System.currentTimeMillis()
            var scheduled = 0

            for (i in 0 until arr.length()) {
                val item = arr.optJSONObject(i) ?: continue
                val id = item.optInt("id", 0)
                val fireAtMs = item.optLong("fireAtMs", 0L)
                if (id == 0 || fireAtMs <= nowMs + 5_000L) continue

                val intent = Intent(context, AdhanAlarmReceiver::class.java).apply {
                    action = "com.nooraya.quranaudio.ACTION_FIRE_ADHAN"
                    putExtra("alarm_json", item.toString())
                    putExtra("alarm_id", id)
                }
                val pi = PendingIntent.getBroadcast(
                    context,
                    id,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                if (canExact) {
                    // setAlarmClock survives Android Doze mode and displays accurately on lock screen
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    val showPi = PendingIntent.getActivity(
                        context,
                        id + 500_000,
                        launchIntent ?: Intent(),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(fireAtMs, showPi), pi)
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAtMs, pi)
                }
                scheduled++
            }
            return Pair(scheduled, canExact)
        }

        fun cancelStoredAlarms(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existing = prefs.getString(KEY_SCHEDULE_JSON, null) ?: return
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            try {
                val arr = JSONArray(existing)
                for (i in 0 until arr.length()) {
                    val id = arr.optJSONObject(i)?.optInt("id", 0) ?: 0
                    if (id == 0) continue
                    val intent = Intent(context, AdhanAlarmReceiver::class.java).apply {
                        action = "com.nooraya.quranaudio.ACTION_FIRE_ADHAN"
                    }
                    val pi = PendingIntent.getBroadcast(
                        context,
                        id,
                        intent,
                        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                    )
                    if (pi != null) {
                        alarmManager.cancel(pi)
                        pi.cancel()
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    @PluginMethod
    fun schedulePrayerAlarms(call: PluginCall) {
        val alarms = call.getArray("alarms")
        if (alarms == null) {
            call.reject("Missing alarms array")
            return
        }

        cancelStoredAlarms(context)
        val rawJson = alarms.toString()
        val (count, exactUsed) = scheduleAlarmsFromJson(context, rawJson)

        val nowIso = Instant.now().toString()
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_SCHEDULE_JSON, rawJson)
            .putString(KEY_LAST_SCHEDULED_AT, nowIso)
            .apply()

        val ret = JSObject().apply {
            put("scheduledCount", count)
            put("exactAlarmUsed", exactUsed)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun cancelAllPrayerAlarms(call: PluginCall) {
        cancelStoredAlarms(context)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .remove(KEY_SCHEDULE_JSON)
            .apply()
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun stopNativeAdhan(call: PluginCall) {
        val stopIntent = Intent(context, AdhanPlaybackForegroundService::class.java).apply {
            action = AdhanPlaybackForegroundService.ACTION_STOP_ADHAN
        }
        context.startService(stopIntent)
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun testNativeAdhanIn10Seconds(call: PluginCall) {
        val alarmObj = call.getObject("alarm")
        if (alarmObj == null) {
            call.reject("Missing alarm payload")
            return
        }
        val fireAtMs = System.currentTimeMillis() + 10_000L
        val testJson = JSONObject(alarmObj.toString()).apply {
            put("id", 999010)
            put("fireAtMs", fireAtMs)
        }
        val arr = JSONArray().put(testJson)
        scheduleAlarmsFromJson(context, arr.toString())
        call.resolve(JSObject().apply {
            put("ok", true)
            put("scheduledForMs", fireAtMs)
        })
    }

    @PluginMethod
    fun getReliabilityStatus(call: PluginCall) {
        ensurePrayerChannels(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        val notificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            nm.areNotificationsEnabled()
        }

        val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

        val batteryUnrestricted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }

        val channelSoundOk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = nm.getNotificationChannel(channelIdForPrayer("dhuhr"))
            ch != null && ch.importance >= NotificationManager.IMPORTANCE_HIGH
        } else {
            true
        }

        val manufacturer = (Build.MANUFACTURER ?: "ANDROID").uppercase()
        val aggressiveOems = setOf("TECNO", "INFINIX", "ITEL", "XIAOMI", "REDMI", "POCO", "SAMSUNG", "OPPO", "REALME", "VIVO", "HUAWEI", "HONOR")

        val ret = JSObject().apply {
            put("notificationsGranted", notificationsGranted)
            put("canScheduleExactAlarms", canExact)
            put("batteryOptimizationIgnored", batteryUnrestricted)
            put("oemManufacturer", manufacturer)
            put("oemRequiresAutostartStep", aggressiveOems.any { manufacturer.contains(it) })
            put("channelSoundConfigured", channelSoundOk)
            put("dndInterruptsAllowed", nm.isNotificationPolicyAccessGranted)
            put("lastScheduledAtIso", prefs.getString(KEY_LAST_SCHEDULED_AT, null))
            put("lastBootRescheduleAtIso", prefs.getString(KEY_LAST_BOOT_RESCHEDULE_AT, null))
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun openNativeSetting(call: PluginCall) {
        val target = call.getString("target") ?: "notifications"
        val opened = when (target) {
            "exact_alarms" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    tryStartIntent(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                        data = Uri.parse("package:${context.packageName}")
                    })
                } else {
                    openAppDetails()
                }
            }
            "battery_optimization" -> {
                tryStartIntent(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${context.packageName}")
                }) || tryStartIntent(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            }
            "oem_autostart" -> openOemAutostartSettings()
            "channel_sound" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    tryStartIntent(Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        putExtra(Settings.EXTRA_CHANNEL_ID, channelIdForPrayer("dhuhr"))
                    })
                } else {
                    openAppDetails()
                }
            }
            "dnd" -> tryStartIntent(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            else -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    tryStartIntent(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    })
                } else {
                    openAppDetails()
                }
            }
        }
        call.resolve(JSObject().put("opened", opened))
    }

    private fun openOemAutostartSettings(): Boolean {
        val candidates = listOf(
            // Tecno / Infinix / Itel (Transsion HiOS / XOS)
            ComponentName("com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"),
            ComponentName("com.transsion.phonemaster", "com.transsion.phonemaster.autostart.AutoStartActivity"),
            // Xiaomi / Redmi / POCO (MIUI / HyperOS)
            ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            // Samsung OneUI (Device Care / Sleeping Apps)
            ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
            // Oppo / Realme (ColorOS)
            ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
            // Vivo (FunTouchOS)
            ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")
        )
        for (cn in candidates) {
            if (tryStartIntent(Intent().setComponent(cn))) return true
        }
        return openAppDetails()
    }

    private fun openAppDetails(): Boolean {
        return tryStartIntent(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
        })
    }

    private fun tryStartIntent(intent: Intent): Boolean {
        return try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }
}
