import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Image,
} from 'react-native';
import { MediaSession } from 'react-native-media-session';
import Sound from 'react-native-nitro-sound';

const localArtwork = require('./assets/PNG_transparency_demonstration_1.png');

const TRACKS = [
  {
    title: 'Remote Stream',
    artist: 'SoundHelix',
    album: 'Online Demo',
    artwork: 'https://picsum.photos/300/300',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    title: 'Local Artwork',
    artist: 'SoundHelix',
    album: 'Local Demo',
    artwork: Image.resolveAssetSource(localArtwork)?.uri as string,
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
];

async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS!
    );
  }
}

export default function App() {
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const started = useRef(false);
  const busy = useRef(false);
  const playingRef = useRef(false);
  const elapsedRef = useRef(0);
  const durationSent = useRef(false);
  const trackRef = useRef(TRACKS[0]);

  const updateNowPlaying = useCallback(
    (track: (typeof TRACKS)[number], dur: number, pos: number) => {
      MediaSession.updateNowPlaying({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.artwork,
        duration: dur,
        elapsedTime: pos,
        speed: 1.0,
      });
    },
    []
  );

  useEffect(() => {
    requestNotificationPermission();

    MediaSession.onRemotePlay(() => {
      if (started.current) {
        Sound.resumePlayer();
      }
      playingRef.current = true;
      setIsPlaying(true);
      MediaSession.updatePlaybackState('playing', elapsedRef.current, 1.0);
    });

    MediaSession.onRemotePause(() => {
      Sound.pausePlayer();
      playingRef.current = false;
      setIsPlaying(false);
      MediaSession.updatePlaybackState('paused', elapsedRef.current, 1.0);
    });

    MediaSession.onRemoteStop(() => {
      Sound.stopPlayer();
      started.current = false;
      playingRef.current = false;
      setIsPlaying(false);
      setElapsed(0);
      MediaSession.updatePlaybackState('stopped', 0, 1.0);
    });

    MediaSession.onRemoteNextTrack(() => {
      // Re-registered in switchTrack effect
    });

    MediaSession.onRemotePreviousTrack(() => {
      // Re-registered in switchTrack effect
    });

    MediaSession.onRemoteSeek((position) => {
      Sound.seekToPlayer(position * 1000);
      elapsedRef.current = position;
      setElapsed(position);
      MediaSession.updatePlaybackState(
        playingRef.current ? 'playing' : 'paused',
        position,
        1.0
      );
    });

    Sound.addPlayBackListener((e) => {
      const currentSec = e.currentPosition / 1000;
      const durationSec = e.duration / 1000;
      elapsedRef.current = currentSec;
      setElapsed(currentSec);
      setDuration(durationSec);

      if (!durationSent.current && durationSec > 0) {
        durationSent.current = true;
        updateNowPlaying(trackRef.current, durationSec, currentSec);
      }

      if (playingRef.current) {
        MediaSession.updatePlaybackState('playing', currentSec, 1.0);
      }
    });

    Sound.addPlaybackEndListener(() => {
      started.current = false;
      playingRef.current = false;
      durationSent.current = false;
      setIsPlaying(false);
      setElapsed(0);
      MediaSession.updatePlaybackState('stopped', 0, 1.0);
    });

    return () => {
      Sound.stopPlayer();
      Sound.removePlayBackListener();
      Sound.removePlaybackEndListener();
      MediaSession.reset();
    };
  }, [updateNowPlaying]);

  const play = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const track = trackRef.current;
      if (!started.current) {
        await Sound.startPlayer(track.uri);
        started.current = true;
        durationSent.current = false;
        updateNowPlaying(track, 0, 0);
      } else {
        await Sound.resumePlayer();
      }
      playingRef.current = true;
      setIsPlaying(true);
      MediaSession.updatePlaybackState('playing', elapsedRef.current, 1.0);
    } finally {
      busy.current = false;
    }
  }, [updateNowPlaying]);

  const pause = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      playingRef.current = false;
      await Sound.pausePlayer();
      setIsPlaying(false);
      MediaSession.updatePlaybackState('paused', elapsedRef.current, 1.0);
    } finally {
      busy.current = false;
    }
  }, []);

  const stop = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      playingRef.current = false;
      await Sound.stopPlayer();
      started.current = false;
      durationSent.current = false;
      setIsPlaying(false);
      setElapsed(0);
      MediaSession.updatePlaybackState('stopped', 0, 1.0);
    } finally {
      busy.current = false;
    }
  }, []);

  const switchTrack = useCallback(
    async (direction: 1 | -1) => {
      if (busy.current) return;
      busy.current = true;
      try {
        if (started.current) {
          playingRef.current = false;
          await Sound.stopPlayer();
          started.current = false;
        }

        const nextIndex =
          (trackIndex + direction + TRACKS.length) % TRACKS.length;
        setTrackIndex(nextIndex);
        trackRef.current = TRACKS[nextIndex]!;
        durationSent.current = false;
        elapsedRef.current = 0;
        setElapsed(0);
        setDuration(0);

        const track = TRACKS[nextIndex]!;
        await Sound.startPlayer(track.uri);
        started.current = true;
        playingRef.current = true;
        setIsPlaying(true);
        updateNowPlaying(track, 0, 0);
        MediaSession.updatePlaybackState('playing', 0, 1.0);
      } finally {
        busy.current = false;
      }
    },
    [trackIndex, updateNowPlaying]
  );

  useEffect(() => {
    MediaSession.onRemoteNextTrack(() => switchTrack(1));
    MediaSession.onRemotePreviousTrack(() => switchTrack(-1));
  }, [switchTrack]);

  const track = TRACKS[trackIndex]!;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{track.title}</Text>
      <Text style={styles.artist}>{track.artist}</Text>
      <Text style={styles.time}>
        {formatTime(elapsed)} / {duration > 0 ? formatTime(duration) : '--:--'}
      </Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => switchTrack(-1)}
        >
          <Text style={styles.buttonText}>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={isPlaying ? pause : play}
        >
          <Text style={styles.buttonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => switchTrack(1)}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.stopButton} onPress={stop}>
        <Text style={styles.buttonText}>Stop</Text>
      </TouchableOpacity>
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
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#e94560',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
  },
  navButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
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
