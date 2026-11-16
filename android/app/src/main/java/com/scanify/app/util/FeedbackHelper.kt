package com.scanify.app.util

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object FeedbackHelper {
    fun playSuccessTone(enabled: Boolean) {
        if (!enabled) return
        runCatching {
            val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 75)
            tone.startTone(ToneGenerator.TONE_PROP_ACK, 120)
        }
    }

    fun vibrate(context: Context, enabled: Boolean) {
        if (!enabled) return
        runCatching {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            vibrator.vibrate(VibrationEffect.createOneShot(45, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }
}
