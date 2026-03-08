#include <jni.h>
#include "mediasessionOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::mediasession::initialize(vm);
}
