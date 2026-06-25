package com.ycssoftware.djtapp;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.razorpay.Checkout;

import org.json.JSONObject;

/**
 * Thin Capacitor wrapper around the native Razorpay Android SDK.
 * Exposed to JS as `RazorpayCheckout.open({...})`.
 *
 * Using the native SDK (instead of web checkout.js in the WebView) is what
 * makes UPI / GPay / PhonePe app intents appear in the payment sheet.
 *
 * The payment result is delivered to MainActivity (which implements
 * PaymentResultWithDataListener); it calls resolveSuccess()/resolveError().
 */
@CapacitorPlugin(name = "RazorpayCheckout")
public class RazorpayCheckoutPlugin extends Plugin {

    // The in-flight checkout call (one payment at a time).
    private static PluginCall savedCall;

    @PluginMethod
    public void open(final PluginCall call) {
        savedCall = call;
        call.setKeepAlive(true);

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Checkout checkout = new Checkout();
                    checkout.setKeyID(call.getString("key"));

                    JSONObject options = new JSONObject();
                    options.put("name", call.getString("name", "DJT HAIKA"));
                    options.put("description", call.getString("description", "Wallet Top-up"));
                    if (call.getString("order_id") != null) options.put("order_id", call.getString("order_id"));
                    options.put("currency", call.getString("currency", "INR"));
                    options.put("amount", Integer.parseInt(call.getString("amount", "0"))); // in paise

                    String contact = call.getString("contact", null);
                    String email = call.getString("email", null);
                    JSONObject prefill = new JSONObject();
                    if (contact != null) prefill.put("contact", contact);
                    if (email != null) prefill.put("email", email);
                    options.put("prefill", prefill);

                    JSONObject theme = new JSONObject();
                    theme.put("color", call.getString("color", "#22D3EE"));
                    options.put("theme", theme);

                    checkout.open(getActivity(), options);
                } catch (Exception e) {
                    resolveError(-1, e.getMessage());
                }
            }
        });
    }

    /** Called from MainActivity.onPaymentSuccess. */
    public static void resolveSuccess(String paymentId, String orderId, String signature) {
        if (savedCall == null) return;
        JSObject resp = new JSObject();
        resp.put("razorpay_payment_id", paymentId);
        resp.put("razorpay_order_id", orderId);
        resp.put("razorpay_signature", signature);
        JSObject ret = new JSObject();
        ret.put("response", resp);
        savedCall.resolve(ret);
        savedCall = null;
    }

    /** Called from MainActivity.onPaymentError (or on local failure). */
    public static void resolveError(int code, String message) {
        if (savedCall == null) return;
        savedCall.reject(message != null ? message : "Payment failed", String.valueOf(code));
        savedCall = null;
    }
}
