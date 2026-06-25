package com.ycssoftware.djtapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.razorpay.Checkout;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;

public class MainActivity extends BridgeActivity implements PaymentResultWithDataListener {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE the Capacitor bridge initialises.
        registerPlugin(RazorpayCheckoutPlugin.class);
        registerPlugin(MediaSaverPlugin.class);
        super.onCreate(savedInstanceState);
        // Warm up the Razorpay SDK for faster checkout.
        Checkout.preload(getApplicationContext());
    }

    @Override
    public void onPaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
        RazorpayCheckoutPlugin.resolveSuccess(
            razorpayPaymentId,
            paymentData != null ? paymentData.getOrderId() : null,
            paymentData != null ? paymentData.getSignature() : null
        );
    }

    @Override
    public void onPaymentError(int code, String response, PaymentData paymentData) {
        RazorpayCheckoutPlugin.resolveError(code, response);
    }
}
