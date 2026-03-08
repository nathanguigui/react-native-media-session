package com.margelo.nitro.mediasession
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class MediaSession : HybridMediaSessionSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
