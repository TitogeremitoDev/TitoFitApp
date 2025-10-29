# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Reglas básicas para React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.devsupport.** { *; }

# Mantener los módulos nativos (¡Muy importante!)
-keep public class * extends com.facebook.react.bridge.BaseActivityEventListener { *; }
-keep public class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep public class * implements com.facebook.react.bridge.NativeModule { *; }

# Esto es para evitar crashes con la serialización (común en ProGuard)
-keepclassmembers class * {
    @com.facebook.react.uimanager.UIProp
    public void set*(...);
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp
    public void set*(...);
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactPropGroup
    public void set*(...);
}