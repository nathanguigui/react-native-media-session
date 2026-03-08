import type { HybridObject } from 'react-native-nitro-modules';

export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'buffering';

export interface NowPlayingInfo {
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  elapsedTime: number;
  speed: number;
}

export interface MediaSession
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  updateNowPlaying(info: NowPlayingInfo): void;
  updatePlaybackState(
    state: PlaybackState,
    elapsedTime: number,
    speed: number
  ): void;
  reset(): void;

  onRemotePlay(callback: () => void): void;
  onRemotePause(callback: () => void): void;
  onRemoteStop(callback: () => void): void;
  onRemoteNextTrack(callback: () => void): void;
  onRemotePreviousTrack(callback: () => void): void;
  onRemoteSeek(callback: (position: number) => void): void;
}
