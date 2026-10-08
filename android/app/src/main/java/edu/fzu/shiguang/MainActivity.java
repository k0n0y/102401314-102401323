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
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 内置页面与共享 API 分开：网络调用由后台线程执行，凭证保存在应用私有空间。 */
public class MainActivity extends Activity {
    private WebView web;
    private final Set<String> assets = new HashSet<>(Arrays.asList("index.html", "styles.css", "domain.js", "network.js", "app.js", "favicon.svg"));
    private final ExecutorService network = Executors.newFixedThreadPool(2);
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
                String mime = name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "text/javascript" : name.endsWith(".svg") ? "image/svg+xml" : "text/html";
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
        network.shutdownNow();
        if (web != null) { web.removeJavascriptInterface("AndroidStore"); web.destroy(); }
        super.onDestroy();
    }
    /** 同步 commit，只有磁盘保存成功才允许前端呈现发布成功。 */
    private class LocalStore {
        private final SharedPreferences preferences;
        private final Context context;
        LocalStore(Context context) {
            this.context = context.getApplicationContext();
            this.preferences = this.context.getSharedPreferences("shiguang", Context.MODE_PRIVATE);
        }
        @JavascriptInterface public synchronized String read() { return preferences.getString("state", ""); }
        @JavascriptInterface public synchronized String readNetwork() { return preferences.getString("network-state", ""); }
        @JavascriptInterface public synchronized boolean saveNetwork(String raw) {
            if (raw == null || raw.length() > 2_000_000) return false;
            try {
                JSONObject data = new JSONObject(raw);
                if (data.getInt("version") != 2) return false;
                return preferences.edit().putString("network-state", raw).commit();
            } catch (Exception exception) { return false; }
        }
        @JavascriptInterface public void request(String id, String base, String path, String method, String body, String token) {
            network.execute(() -> {
                JSONObject result = new JSONObject();
                HttpURLConnection connection = null;
                try {
                    URL endpoint = new URL(base);
                    String host = endpoint.getHost();
                    boolean privateHost = host.matches("localhost|127\\.0\\.0\\.1|10\\.(\\d{1,3}\\.){2}\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}");
                    if (!("https".equals(endpoint.getProtocol()) || ("http".equals(endpoint.getProtocol()) && privateHost)) || endpoint.getUserInfo() != null || !path.matches("/api/[a-zA-Z0-9/?=&%._-]+") || !(method.equals("GET") || method.equals("POST") || method.equals("PATCH"))) throw new IOException("Invalid endpoint");
                    connection = (HttpURLConnection) new URL(base + path).openConnection();
                    connection.setConnectTimeout(6000); connection.setReadTimeout(6000);
                    connection.setInstanceFollowRedirects(false); connection.setRequestMethod(method);
                    if (!token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
                    if (!body.isEmpty()) {
                        connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
                        byte[] payload = body.getBytes(StandardCharsets.UTF_8);
                        connection.setFixedLengthStreamingMode(payload.length);
                        try (java.io.OutputStream output = connection.getOutputStream()) { output.write(payload); }
                    }
                    int status = connection.getResponseCode();
                    InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    if (input != null) try (InputStream stream = input) {
                        byte[] bytes = new byte[4096]; int count;
                        while ((count = stream.read(bytes)) != -1) { buffer.write(bytes, 0, count); if (buffer.size() > 2_000_000) throw new IOException("Response too large"); }
                    }
                    result.put("status", status); result.put("text", new String(buffer.toByteArray(), StandardCharsets.UTF_8));
                } catch (Exception exception) {
                    try { result.put("error", "未连接共享服务，请检查服务地址、网络和服务是否启动"); } catch (Exception ignored) {}
                } finally { if (connection != null) connection.disconnect(); }
                String script = "window.ShiguangNet && ShiguangNet.complete(" + JSONObject.quote(id) + "," + result.toString() + ")";
                runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) web.evaluateJavascript(script, null); });
            });
        }
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
