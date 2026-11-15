package fr.pfa.veille;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VigilanceHaptics")
public class VigilanceHapticsPlugin extends Plugin {
    private volatile boolean foreground = true;
    private Vibrator vibrator() {
        return (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }
    @PluginMethod public void capability(PluginCall call) {
        Vibrator device = vibrator();
        JSObject result = new JSObject();
        result.put("available", device != null && device.hasVibrator());
        result.put("amplitudeControl", device != null && Build.VERSION.SDK_INT >= 26 && device.hasAmplitudeControl());
        call.resolve(result);
    }
    @PluginMethod public void pulse(PluginCall call) {
        Vibrator device = vibrator();
        boolean available = device != null && device.hasVibrator();
        if (available && foreground) {
            int level = Math.max(0, Math.min(2, call.getInt("level", 0)));
            long[][] timings = { {0, 40}, {0, 80, 120, 80}, {0, 120, 140, 120, 140, 120} };
            long[] pattern = timings[level];
            if (Build.VERSION.SDK_INT >= 26) {
                int[] amplitudes = new int[pattern.length];
                for (int i = 1; i < amplitudes.length; i += 2) amplitudes[i] = device.hasAmplitudeControl() ? new int[] {40, 80, 140}[level] : VibrationEffect.DEFAULT_AMPLITUDE;
                device.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1));
            } else {
                device.vibrate(pattern, -1);
            }
        }
        JSObject result = new JSObject(); result.put("available", available); call.resolve(result);
    }
    @PluginMethod public void cancel(PluginCall call) {
        Vibrator device = vibrator(); if (device != null) device.cancel(); call.resolve();
    }
    @Override protected void handleOnPause() { foreground = false; Vibrator device = vibrator(); if (device != null) device.cancel(); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() { Vibrator device = vibrator(); if (device != null) device.cancel(); }
}
