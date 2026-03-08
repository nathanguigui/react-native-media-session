import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { MediaSession } from 'react-native-media-session';

const TRACK = {
  title: 'Demo Track',
  artist: 'Artist Name',
  album: 'Album Name',
  artwork: 'https://picsum.photos/300/300',
};

const DURATION = 240;

async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS!
    );
  }
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    requestNotificationPermission();

    MediaSession.onRemotePlay(() => {
      setIsPlaying(true);
    });

    MediaSession.onRemotePause(() => {
      setIsPlaying(false);
    });

    MediaSession.onRemoteStop(() => {
      setIsPlaying(false);
      setElapsed(0);
      elapsedRef.current = 0;
    });

    MediaSession.onRemoteNextTrack(() => {
      console.log('[MediaSession] Next track');
    });

    MediaSession.onRemotePreviousTrack(() => {
      console.log('[MediaSession] Previous track');
    });

    MediaSession.onRemoteSeek((position) => {
      setElapsed(position);
      elapsedRef.current = position;
      MediaSession.updatePlaybackState('playing', position, 1.0);
    });

    MediaSession.updateNowPlaying({
      title: TRACK.title,
      artist: TRACK.artist,
      album: TRACK.album,
      artwork: TRACK.artwork,
      duration: DURATION,
      elapsedTime: 0,
      speed: 1.0,
    });

    return () => {
      MediaSession.reset();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      MediaSession.updatePlaybackState('paused', elapsedRef.current, 1.0);
      return;
    }

    MediaSession.updatePlaybackState('playing', elapsedRef.current, 1.0);

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlayback = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setElapsed(0);
    elapsedRef.current = 0;
    MediaSession.updatePlaybackState('stopped', 0, 1.0);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{TRACK.title}</Text>
      <Text style={styles.artist}>{TRACK.artist}</Text>
      <Text style={styles.time}>
        {formatTime(elapsed)} / {formatTime(DURATION)}
      </Text>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={togglePlayback}>
          <Text style={styles.buttonText}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stopButton} onPress={stop}>
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  artist: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 20,
  },
  time: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    backgroundColor: '#e94560',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
  },
  stopButton: {
    backgroundColor: '#444',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
