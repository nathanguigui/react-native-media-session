import { NitroModules } from 'react-native-nitro-modules';
import type { MediaSession as MediaSessionType } from './MediaSession.nitro';
export type { NowPlayingInfo, PlaybackState } from './MediaSession.nitro';

export const MediaSession =
  NitroModules.createHybridObject<MediaSessionType>('MediaSession');
