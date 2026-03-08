package com.margelo.nitro.mediasession

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import com.facebook.proguard.annotations.DoNotStrip
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

@DoNotStrip
class MediaSession : HybridMediaSessionSpec() {

    companion object {
        private const val CHANNEL_ID = "media_session_channel"
        private const val NOTIFICATION_ID = 1
        private var appContext: Context? = null

        fun setContext(context: Context) {
            appContext = context.applicationContext
        }
    }

    private var mediaSession: MediaSessionCompat? = null
    private var currentMetadata: MediaMetadataCompat? = null
    private var currentState: PlaybackStateCompat? = null
    private var currentArtwork: Bitmap? = null

    private val playListeners = mutableListOf<() -> Unit>()
    private val pauseListeners = mutableListOf<() -> Unit>()
    private val stopListeners = mutableListOf<() -> Unit>()
    private val nextListeners = mutableListOf<() -> Unit>()
    private val previousListeners = mutableListOf<() -> Unit>()
    private val seekListeners = mutableListOf<(Double) -> Unit>()

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private fun getContext(): Context {
        return appContext ?: throw IllegalStateException(
            "MediaSession context not set. Ensure MediaSessionPackage is registered."
        )
    }

    private fun ensureMediaSession() {
        if (mediaSession != null) return
        val context = getContext()
        createNotificationChannel(context)
        mediaSession = MediaSessionCompat(context, "MediaSession").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    playListeners.forEach { it() }
                }

                override fun onPause() {
                    pauseListeners.forEach { it() }
                }

                override fun onStop() {
                    stopListeners.forEach { it() }
                }

                override fun onSkipToNext() {
                    nextListeners.forEach { it() }
                }

                override fun onSkipToPrevious() {
                    previousListeners.forEach { it() }
                }

                override fun onSeekTo(pos: Long) {
                    val positionSeconds = pos.toDouble() / 1000.0
                    seekListeners.forEach { it(positionSeconds) }
                }
            })
            isActive = true
        }
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Media Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Media playback controls"
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun updateNowPlaying(info: NowPlayingInfo) {
        ensureMediaSession()

        val metadataBuilder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, info.title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, info.artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, info.album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (info.duration * 1000).toLong())

        currentArtwork?.let {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
        }

        currentMetadata = metadataBuilder.build()
        mediaSession?.setMetadata(currentMetadata)

        updatePlaybackState(state = PlaybackState.PLAYING, elapsedTime = info.elapsedTime, speed = info.speed)

        if (info.artwork.isNotEmpty()) {
            scope.launch {
                val bitmap = loadBitmap(info.artwork)
                if (bitmap != null) {
                    currentArtwork = bitmap
                    val updatedMetadata = MediaMetadataCompat.Builder()
                        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, info.title)
                        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, info.artist)
                        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, info.album)
                        .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (info.duration * 1000).toLong())
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                        .build()
                    currentMetadata = updatedMetadata
                    mediaSession?.setMetadata(updatedMetadata)
                    showNotification()
                }
            }
        }

        showNotification()
    }

    override fun updatePlaybackState(state: PlaybackState, elapsedTime: Double, speed: Double) {
        ensureMediaSession()

        val pbState = when (state) {
            PlaybackState.PLAYING -> PlaybackStateCompat.STATE_PLAYING
            PlaybackState.PAUSED -> PlaybackStateCompat.STATE_PAUSED
            PlaybackState.STOPPED -> PlaybackStateCompat.STATE_STOPPED
            PlaybackState.BUFFERING -> PlaybackStateCompat.STATE_BUFFERING
        }

        val actions = PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_STOP or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO

        currentState = PlaybackStateCompat.Builder()
            .setState(pbState, (elapsedTime * 1000).toLong(), speed.toFloat())
            .setActions(actions)
            .build()

        mediaSession?.setPlaybackState(currentState)
        showNotification()
    }

    override fun reset() {
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        currentMetadata = null
        currentState = null
        currentArtwork = null

        playListeners.clear()
        pauseListeners.clear()
        stopListeners.clear()
        nextListeners.clear()
        previousListeners.clear()
        seekListeners.clear()

        val context = getContext()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)

        scope.cancel()
    }

    override fun onRemotePlay(callback: () -> Unit) {
        playListeners.add(callback)
    }

    override fun onRemotePause(callback: () -> Unit) {
        pauseListeners.add(callback)
    }

    override fun onRemoteStop(callback: () -> Unit) {
        stopListeners.add(callback)
    }

    override fun onRemoteNextTrack(callback: () -> Unit) {
        nextListeners.add(callback)
    }

    override fun onRemotePreviousTrack(callback: () -> Unit) {
        previousListeners.add(callback)
    }

    override fun onRemoteSeek(callback: (Double) -> Unit) {
        seekListeners.add(callback)
    }

    private fun showNotification() {
        val context = getContext()
        val session = mediaSession ?: return

        val isPlaying = currentState?.state == PlaybackStateCompat.STATE_PLAYING

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentMetadata?.getString(MediaMetadataCompat.METADATA_KEY_TITLE) ?: "")
            .setContentText(currentMetadata?.getString(MediaMetadataCompat.METADATA_KEY_ARTIST) ?: "")
            .setOngoing(isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )

        currentArtwork?.let {
            builder.setLargeIcon(it)
        }

        builder.addAction(
            android.R.drawable.ic_media_previous,
            "Previous",
            androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                context, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            )
        )

        if (isPlaying) {
            builder.addAction(
                android.R.drawable.ic_media_pause,
                "Pause",
                androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                    context, PlaybackStateCompat.ACTION_PAUSE
                )
            )
        } else {
            builder.addAction(
                android.R.drawable.ic_media_play,
                "Play",
                androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                    context, PlaybackStateCompat.ACTION_PLAY
                )
            )
        }

        builder.addAction(
            android.R.drawable.ic_media_next,
            "Next",
            androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                context, PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            )
        )

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, builder.build())
    }

    private suspend fun loadBitmap(source: String): Bitmap? = withContext(Dispatchers.IO) {
        try {
            if (source.startsWith("http://") || source.startsWith("https://")) {
                val url = URL(source)
                val connection = url.openConnection() as HttpURLConnection
                connection.doInput = true
                connection.connect()
                val input = connection.inputStream
                val bitmap = BitmapFactory.decodeStream(input)
                input.close()
                connection.disconnect()
                bitmap
            } else {
                BitmapFactory.decodeFile(source)
            }
        } catch (e: Exception) {
            null
        }
    }
}
