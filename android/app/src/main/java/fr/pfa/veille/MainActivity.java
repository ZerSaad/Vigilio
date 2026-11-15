package fr.pfa.veille;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SessionExportPlugin.class);
        registerPlugin(VigilanceHapticsPlugin.class);
        registerPlugin(VigilanceDisplayPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    @Override public void onStop() {
        if (getBridge() != null) getBridge().triggerWindowJSEvent("veille:background");
        super.onStop();
    }
}
