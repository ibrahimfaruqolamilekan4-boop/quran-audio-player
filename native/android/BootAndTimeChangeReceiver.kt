package com.nooraya.quranaudio.adhan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.time.Instant

/**
 * Re-registers all cached future offline prayer alarms completely offline after:
 * - Device reboot (`BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED`)
 * - App update (`MY_PACKAGE_REPLACED`)
 * - System clock or timezone/DST change (`TIME_SET`, `TIMEZONE_CHANGED`)
 * - User granting `SCHEDULE_EXACT_ALARM` in Android Settings
 *   (`ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`)
 */
class BootAndTimeChangeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences(NoorayaAdhanPlugin.PREFS_NAME, Context.MODE_PRIVATE)
        val cachedJson = prefs.getString(NoorayaAdhanPlugin.KEY_SCHEDULE_JSON, null) ?: return

        NoorayaAdhanPlugin.cancelStoredAlarms(context)
        NoorayaAdhanPlugin.scheduleAlarmsFromJson(context, cachedJson)

        prefs.edit()
            .putString(NoorayaAdhanPlugin.KEY_LAST_BOOT_RESCHEDULE_AT, Instant.now().toString())
            .apply()
    }
}
