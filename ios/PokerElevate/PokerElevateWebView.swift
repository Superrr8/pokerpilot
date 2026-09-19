import SwiftUI
import UIKit
import WebKit

struct PokerElevateWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        let contentController = configuration.userContentController
        contentController.add(context.coordinator, name: NativeBridge.hapticsHandler)
        contentController.add(context.coordinator, name: NativeBridge.diagnosticsHandler)
        contentController.addUserScript(WKUserScript(
            source: NativeBridge.script,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.043, green: 0.051, blue: 0.063, alpha: 1)
        webView.underPageBackgroundColor = webView.backgroundColor
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        webView.allowsBackForwardNavigationGestures = false

        guard
            let indexURL = Bundle.main.url(forResource: "index", withExtension: "html"),
            let resourceRoot = Bundle.main.resourceURL
        else {
            webView.loadHTMLString(NativeBridge.missingResourcesPage, baseURL: nil)
            return webView
        }

        webView.loadFileURL(indexURL, allowingReadAccessTo: resourceRoot)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: NativeBridge.hapticsHandler
        )
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: NativeBridge.diagnosticsHandler
        )
    }
}

final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let legalHost = "superrr8.github.io"
    private let legalPath = "/pokerpilot/legal/"

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        switch message.name {
        case NativeBridge.hapticsHandler:
            NativeHapticBridge.play(message.body)
        case NativeBridge.diagnosticsHandler:
            if ProcessInfo.processInfo.environment["POKERELEVATE_NATIVE_VALIDATION"] == "1" {
                print("POKERELEVATE_WEB_RUNTIME \(String(describing: message.body))")
            }
        default:
            break
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if url.isFileURL {
            decisionHandler(.allow)
            return
        }

        if navigationAction.navigationType == .linkActivated, openCanonicalLegalURL(url) {
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            _ = openCanonicalLegalURL(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard ProcessInfo.processInfo.environment["POKERELEVATE_NATIVE_VALIDATION"] == "1" else {
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            self.runValidationDiagnostics(in: webView)
        }
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        print("POKERELEVATE_NATIVE_LOAD_ERROR \(error.localizedDescription)")
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        print("POKERELEVATE_NATIVE_LOAD_ERROR \(error.localizedDescription)")
    }

    private func openCanonicalLegalURL(_ url: URL) -> Bool {
        guard
            url.scheme?.lowercased() == "https",
            url.host?.lowercased() == legalHost,
            url.path == legalPath || url.path.hasPrefix(legalPath)
        else {
            return false
        }
        UIApplication.shared.open(url, options: [:])
        return true
    }

    private func runValidationDiagnostics(in webView: WKWebView) {
        webView.evaluateJavaScript(NativeBridge.validationScript) { value, error in
            if let error {
                print("POKERELEVATE_NATIVE_VALIDATION_ERROR \(error.localizedDescription)")
                return
            }
            guard
                let dictionary = value as? [String: Any],
                JSONSerialization.isValidJSONObject(dictionary),
                let data = try? JSONSerialization.data(withJSONObject: dictionary, options: [.sortedKeys]),
                let json = String(data: data, encoding: .utf8)
            else {
                print("POKERELEVATE_NATIVE_VALIDATION_ERROR invalid-result")
                return
            }
            print("POKERELEVATE_NATIVE_VALIDATION \(json)")
        }
    }
}

private enum NativeHapticBridge {
    static func play(_ body: Any) {
        let values: [Double]
        if let number = body as? NSNumber {
            values = [number.doubleValue]
        } else if let numbers = body as? [NSNumber] {
            values = numbers.map(\.doubleValue)
        } else {
            return
        }

        var elapsed = 0.0
        for (index, duration) in values.enumerated() {
            let boundedDuration = min(max(duration, 0), 100)
            if index.isMultiple(of: 2) {
                DispatchQueue.main.asyncAfter(deadline: .now() + elapsed / 1_000) {
                    let style: UIImpactFeedbackGenerator.FeedbackStyle
                    if boundedDuration >= 16 {
                        style = .heavy
                    } else if boundedDuration >= 10 {
                        style = .medium
                    } else {
                        style = .light
                    }
                    let generator = UIImpactFeedbackGenerator(style: style)
                    generator.prepare()
                    generator.impactOccurred(intensity: min(max(boundedDuration / 20, 0.35), 0.9))
                }
            }
            elapsed += boundedDuration
        }
    }
}

private enum NativeBridge {
    static let hapticsHandler = "pokerElevateHaptics"
    static let diagnosticsHandler = "pokerElevateDiagnostics"

    static let script = #"""
    (() => {
      const haptics = window.webkit?.messageHandlers?.pokerElevateHaptics;
      if (haptics) {
        const vibrate = pattern => {
          haptics.postMessage(pattern);
          return true;
        };
        try {
          Object.defineProperty(navigator, 'vibrate', {
            configurable: true,
            value: vibrate
          });
        } catch (_) {
          navigator.vibrate = vibrate;
        }
      }

      const diagnostics = window.webkit?.messageHandlers?.pokerElevateDiagnostics;
      if (diagnostics) {
        window.addEventListener('error', event => {
          diagnostics.postMessage({ type: 'error', message: String(event.message || 'Script error') });
        });
        window.addEventListener('unhandledrejection', event => {
          diagnostics.postMessage({ type: 'rejection', message: String(event.reason || 'Unhandled rejection') });
        });
      }
    })();
    """#

    static let validationScript = #"""
    (() => {
      const storageKey = 'pokerelevate.native.validation.v1';
      const storagePrevious = Number(localStorage.getItem(storageKey) || 0);
      const storageCurrent = storagePrevious + 1;
      localStorage.setItem(storageKey, String(storageCurrent));

      const i18n = window.PokerElevateI18n;
      const originalLocale = i18n?.getLocale?.() || 'en';
      const alternateLocale = originalLocale === 'en' ? 'ru' : 'en';
      i18n?.setLocale?.(alternateLocale);
      const localeSwitch = i18n?.getLocale?.() === alternateLocale;
      i18n?.setLocale?.(originalLocale);

      return {
        protocol: location.protocol,
        dashboardReady: Boolean(window.__pokerPilotSmoke?.dashboardReady),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        navigationItems: document.querySelectorAll('.primary-navigation button').length,
        activeScreen: document.querySelector('.screen.active')?.id || null,
        storagePrevious,
        storageCurrent,
        locale: i18n?.getLocale?.() || null,
        localeSwitch,
        termsIdentity: window.PokerElevateCompliance?.getDocument?.('terms', 'en')?.documentId || null,
        privacyIdentity: window.PokerElevateCompliance?.getDocument?.('privacy', 'ru')?.documentId || null,
        soundManager: Boolean(window.SoundManager && window.SonicIdentityAssets),
        audioContext: Boolean(window.AudioContext || window.webkitAudioContext),
        hapticsSupported: window.HapticManager?.getInstance?.().isSupported?.() === true
      };
    })();
    """#

    static let missingResourcesPage = #"""
    <!doctype html>
    <html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="margin:0;background:#0b0d10;color:#f4f1e9;font:17px -apple-system;padding:48px 24px">
    PokerElevate could not load its bundled application resources.
    </body></html>
    """#
}
