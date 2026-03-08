import { NitroModules } from 'react-native-nitro-modules';
import type { MediaSession } from './MediaSession.nitro';

const MediaSessionHybridObject =
  NitroModules.createHybridObject<MediaSession>('MediaSession');

export function multiply(a: number, b: number): number {
  return MediaSessionHybridObject.multiply(a, b);
}
