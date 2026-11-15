package fr.pfa.veille;

import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VigilanceDisplay")
public class VigilanceDisplayPlugin extends Plugin {
    private Float originalBrightness = null;
    private volatile boolean foreground = true;

    @PluginMethod public void begin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!foreground) { call.resolve(); return; }
            try {
                Window window = getActivity().getWindow();
                WindowManager.LayoutParams attributes = window.getAttributes();
                if (originalBrightness == null) originalBrightness = attributes.screenBrightness;
                attributes.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL;
                window.setAttributes(attributes);
                call.resolve();
            } catch (Exception error) { call.reject("Luminosité indisponible", error); }
        });
    }
    @PluginMethod public void end(PluginCall call) {
        getActivity().runOnUiThread(() -> { restore(); call.resolve(); });
    }
    private void restore() {
        if (originalBrightness == null) return;
        Window window = getActivity().getWindow();
        WindowManager.LayoutParams attributes = window.getAttributes();
        attributes.screenBrightness = originalBrightness;
        window.setAttributes(attributes);
        originalBrightness = null;
    }
    @Override protected void handleOnPause() { foreground = false; getActivity().runOnUiThread(this::restore); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() { getActivity().runOnUiThread(this::restore); }
}
