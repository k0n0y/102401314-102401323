package edu.fzu.shiguang;

import android.app.Activity;
import android.os.Bundle;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** 单一离线入口：只加载内置资源，不请求网络或设备敏感权限。 */
public class MainActivity extends Activity {
    private WebView web;
    private final Set<String> assets = new HashSet<>(Arrays.asList("index.html", "styles.css", "domain.js", "app.js"));
    private static final String HOST = "appassets.androidplatform.net";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(246, 248, 246));
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(246, 248, 246));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (android.os.Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            });
        }
        web.setBackgroundColor(Color.rgb(246, 248, 246));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.getSettings().setTextZoom(100);
        WebView.setWebContentsDebuggingEnabled(true); // 课程测试包：供模拟器 CDP 验证
        web.addJavascriptInterface(new LocalStore(this), "AndroidStore");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isLocal(uri)) return errorResponse();
                String name = uri.getPath().replaceFirst("^/", "");
                if (!assets.contains(name)) return errorResponse();
                String mime = name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "text/javascript" : "text/html";
                try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(name)); }
                catch (IOException exception) { return errorResponse(); }
            }
        });
        web.loadUrl("https://" + HOST + "/index.html#/home");
    }
    private boolean isLocal(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()); }
    private WebResourceResponse errorResponse() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
            new ByteArrayInputStream("Local resource not found".getBytes(StandardCharsets.UTF_8)));
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.appBack ? window.appBack() : false", result -> {
            if (!"true".equals(result)) MainActivity.super.onBackPressed();
        });
    }
    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("AndroidStore"); web.destroy(); }
        super.onDestroy();
    }
    /** 同步 commit，只有磁盘保存成功才允许前端呈现发布成功。 */
    private static class LocalStore {
        private final SharedPreferences preferences;
        private final Context context;
        LocalStore(Context context) {
            this.context = context.getApplicationContext();
            this.preferences = this.context.getSharedPreferences("shiguang", Context.MODE_PRIVATE);
        }
        @JavascriptInterface public synchronized String read() { return preferences.getString("state", ""); }
        @JavascriptInterface public synchronized boolean save(String raw) {
            if (raw == null || raw.length() > 2_000_000) return false;
            try {
                JSONObject data = new JSONObject(raw);
                if (data.getInt("version") != 1 || data.getJSONArray("items").length() > 2000) return false;
                return preferences.edit().putString("state", raw).commit();
            } catch (Exception exception) { return false; }
        }
        @JavascriptInterface public boolean copy(String value) {
            try {
                if (value == null || value.length() > 80) return false;
                ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("拾光联系方式", value));
                return true;
            } catch (Exception exception) { return false; }
        }
    }
}
