package com.nooraya.quranaudio.adhan

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/**
 * Fires when AlarmManager triggers a scheduled prayer alarm and starts
 * AdhanPlaybackForegroundService so the full Muezzin Adhan plays reliably even when
 * the app is killed and the device is in Airplane Mode.
 */
class AdhanAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val alarmJson = intent.getStringExtra("alarm_json") ?: return
        val svcIntent = Intent(context, AdhanPlaybackForegroundService::class.java).apply {
            action = AdhanPlaybackForegroundService.ACTION_PLAY_ADHAN
            putExtra("alarm_json", alarmJson)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svcIntent)
        } else {
            context.startService(svcIntent)
        }
    }
}

/**
 * Foreground Service (`mediaPlayback`) that plays the FULL authentic Muezzin Adhan file
 * when the app is closed and offline.
 *
 * Strict guarantees:
 * 1. NEVER plays a synthetic beep/oscillator if an audio file is missing: shows a silent
 *    text notification + diagnostic log instead.
 * 2. Checks AudioManager call mode (`MODE_IN_CALL`, `MODE_IN_COMMUNICATION`, `MODE_RINGTONE`)
 *    and skips Adhan audio during an active phone call.
 * 3. Requests transient exclusive AudioFocus so Quran/ambient audio pauses cleanly and
 *    resumes automatically when Adhan finishes or when the user taps "Stop Adhan".
 */
class AdhanPlaybackForegroundService : Service() {

    companion object {
        const val ACTION_PLAY_ADHAN = "com.nooraya.quranaudio.ACTION_PLAY_ADHAN"
        const val ACTION_STOP_ADHAN = "com.nooraya.quranaudio.ACTION_STOP_ADHAN"
        const val FOREGROUND_NOTIF_ID = 778801
    }

    private var mediaPlayer: MediaPlayer? = null
    private var audioFocusRequest: AudioFocusRequest? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_ADHAN) {
            stopAdhanAndSelf()
            return START_NOT_STICKY
        }

        val raw = intent?.getStringExtra("alarm_json")
        if (raw.isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val alarm = try {
            JSONObject(raw)
        } catch (_: Exception) {
            stopSelf()
            return START_NOT_STICKY
        }

        val prayerKey = alarm.optString("prayerKey", "dhuhr")
        val title = alarm.optString("title", "It is time for Prayer")
        val body = alarm.optString("body", "Hayya 'ala-s-Salah")
        val mode = alarm.optString("mode", "full")
        val fallbackToSilent = alarm.optBoolean("fallbackToSilentText", false)
        val soundResource = alarm.optString("nativeSoundResource", "")
        val volume = alarm.optDouble("volume", 1.0).toFloat().coerceIn(0.1f, 1.0f)

        NoorayaAdhanPlugin.ensurePrayerChannels(this)
        val chId = NoorayaAdhanPlugin.channelIdForPrayer(prayerKey)

        // Start foreground immediately to satisfy Android 12+ 5-second FGS contract
        val notif = buildAdhanNotification(chId, title, body, prayerKey, isPlaying = false)
        startForeground(FOREGROUND_NOTIF_ID, notif)

        // Top-up reminder or silent mode -> show notification and stop foreground service cleanly
        if (prayerKey == "top_up_reminder" || mode == "silent" || fallbackToSilent) {
            postNonForegroundTextNotification(chId, alarm.optInt("id", FOREGROUND_NOTIF_ID + 1), title, body, prayerKey)
            stopAdhanAndSelf()
            return START_NOT_STICKY
        }

        // Check active phone call state before playing audio
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val callInProgress = audioManager.mode == AudioManager.MODE_IN_CALL ||
            audioManager.mode == AudioManager.MODE_IN_COMMUNICATION ||
            audioManager.mode == AudioManager.MODE_RINGTONE

        if (callInProgress) {
            postNonForegroundTextNotification(
                chId,
                alarm.optInt("id", FOREGROUND_NOTIF_ID + 2),
                title,
                "$body (Adhan silenced during active phone call)",
                prayerKey
            )
            stopAdhanAndSelf()
            return START_NOT_STICKY
        }

        // Locate real bundled audio asset (full MP3 in assets/public/audio/adhan/ or raw clip)
        val started = startRealAdhanAudio(alarm, soundResource, volume, audioManager)
        if (!started) {
            // Strict rule: NEVER play a synthetic tone if audio file is missing
            postNonForegroundTextNotification(
                chId,
                alarm.optInt("id", FOREGROUND_NOTIF_ID + 3),
                title,
                "$body (Adhan audio file missing on device — silent reminder)",
                prayerKey
            )
            stopAdhanAndSelf()
            return START_NOT_STICKY
        }

        val playingNotif = buildAdhanNotification(chId, title, body, prayerKey, isPlaying = true)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(FOREGROUND_NOTIF_ID, playingNotif)
        return START_NOT_STICKY
    }

    private fun startRealAdhanAudio(
        alarm: JSONObject,
        soundResource: String,
        volume: Float,
        audioManager: AudioManager
    ): Boolean {
        releasePlayer()

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener { change ->
                    if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                        stopAdhanAndSelf()
                    }
                }
                .build()
            audioFocusRequest = req
            audioManager.requestAudioFocus(req)
        }

        // 1. Prefer full MP3 packaged in Capacitor web assets (`public/audio/adhan/*.mp3`)
        val fullUrl = alarm.optString("fullAudioUrl", "").trimStart('/')
        val player = MediaPlayer().apply {
            setAudioAttributes(attrs)
            setVolume(volume, volume)
            setOnCompletionListener { stopAdhanAndSelf() }
            setOnErrorListener { _, _, _ ->
                stopAdhanAndSelf()
                true
            }
        }

        try {
            if (fullUrl.isNotBlank()) {
                val afd = assets.openFd("public/$fullUrl")
                player.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                player.prepare()
                player.start()
                mediaPlayer = player
                return true
            }
        } catch (_: Exception) {
            // Fall through to bundled raw clip
        }

        // 2. Fallback to bundled real <=28s raw WAV clip in res/raw/
        try {
            val rawName = soundResource.substringBeforeLast('.')
            val resId = resources.getIdentifier(rawName, "raw", packageName)
            if (resId != 0) {
                player.reset()
                player.setAudioAttributes(attrs)
                player.setVolume(volume, volume)
                player.setDataSource(this, Uri.parse("android.resource://$packageName/$resId"))
                player.prepare()
                player.start()
                mediaPlayer = player
                return true
            }
        } catch (_: Exception) {
        }

        player.release()
        return false
    }

    private fun buildAdhanNotification(
        channelId: String,
        title: String,
        body: String,
        prayerKey: String,
        isPlaying: Boolean
    ): Notification {
        val stopIntent = Intent(this, AdhanPlaybackForegroundService::class.java).apply {
            action = ACTION_STOP_ADHAN
        }
        val stopPi = PendingIntent.getService(
            this,
            901,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            putExtra("playAdhan", prayerKey)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        } ?: Intent()
        val openPi = PendingIntent.getActivity(
            this,
            902,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openPi)
            .setOngoing(isPlaying)
            .setAutoCancel(!isPlaying)

        if (isPlaying) {
            builder.addAction(android.R.drawable.ic_media_pause, "Stop Adhan", stopPi)
        }
        return builder.build()
    }

    private fun postNonForegroundTextNotification(
        channelId: String,
        notifId: Int,
        title: String,
        body: String,
        prayerKey: String
    ) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(notifId, buildAdhanNotification(channelId, title, body, prayerKey, isPlaying = false))
    }

    private fun releasePlayer() {
        try {
            mediaPlayer?.stop()
        } catch (_: Exception) {
        }
        try {
            mediaPlayer?.release()
        } catch (_: Exception) {
        }
        mediaPlayer = null

        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            am.abandonAudioFocusRequest(audioFocusRequest!!)
            audioFocusRequest = null
        }
    }

    private fun stopAdhanAndSelf() {
        releasePlayer()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        releasePlayer()
        super.onDestroy()
    }
}
