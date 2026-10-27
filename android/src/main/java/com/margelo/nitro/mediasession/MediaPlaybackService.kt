package com.margelo.nitro.mediasession

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.media.session.MediaButtonReceiver

/**
 * Foreground service of type mediaPlayback. Without it, Android freezes or kills
 * the process shortly after the app goes to background and audio stops.
 * It also receives MEDIA_BUTTON intents from MediaButtonReceiver (notification actions,
 * headset buttons) and forwards them to the MediaSession.
 */
class MediaPlaybackService : Service() {

    companion object {
        private const val TAG = "MediaPlaybackService"
        private var instance: MediaPlaybackService? = null

        /** Start (or update) the service in foreground with the given notification. */
        fun startForeground(context: Context, notification: Notification) {
            MediaSession.pendingNotification = notification
            val service = instance
            if (service != null) {
                service.promote(notification)
                return
            }
            try {
                ContextCompat.startForegroundService(context, Intent(context, MediaPlaybackService::class.java))
            } catch (e: Exception) {
                // ForegroundServiceStartNotAllowedException when started from background (Android 12+)
                Log.w(TAG, "Unable to start foreground service", e)
            }
        }

        /** Leave foreground but keep the notification (paused state, swipeable). */
        fun demote() {
            instance?.let {
                ServiceCompat.stopForeground(it, ServiceCompat.STOP_FOREGROUND_DETACH)
            }
        }

        fun stop() {
            instance?.let {
                ServiceCompat.stopForeground(it, ServiceCompat.STOP_FOREGROUND_REMOVE)
                it.stopSelf()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = MediaSession.pendingNotification
        if (notification == null) {
            // Started without anything to play (e.g. media button after process death):
            // startForeground must still be called to avoid a crash, then bail out.
            promote(MediaSession.buildPlaceholderNotification(this))
            stop()
            return START_NOT_STICKY
        }
        promote(notification)

        if (intent?.action == Intent.ACTION_MEDIA_BUTTON) {
            MediaSession.activeSession?.let { MediaButtonReceiver.handleIntent(it, intent) }
        }
        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // App swiped away from recents: stop playing in background
        MediaSession.activeSession?.controller?.transportControls?.stop()
        stop()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun promote(notification: Notification) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        } else {
            0
        }
        ServiceCompat.startForeground(this, MediaSession.NOTIFICATION_ID, notification, type)
    }
}
