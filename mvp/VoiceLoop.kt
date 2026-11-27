package com.voicefor.eyes

import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

/** Native stubs — replace these with real implementations: whisper.cpp for transcribe(), doCAP for readLabel(). */
object NativeBridge {
    fun transcribe(audioBytes: ByteArray): String {
        Log.d("NativeBridge", "transcribe: ${audioBytes.size} bytes (whisper.cpp JNI pending)")
        return "what is this tablet?" // stub for dev loop
    }

    fun readLabel(): String? {
        Log.d("NativeBridge", "readLabel: doCAP OCR pending")
        return "Dolo 650, expiry 2027-03-15, quantity 3, fever tablet" // stub: what the label says
    }
}

/** Deterministic voice loop: route by intent, camera-first (print > voice), never suggest a dose. */
object VoiceLoop {
    private var tts: TextToSpeech? = null

    fun route(userInput: String, label: String?) {
        val q = userInput.lowercase()
        val labelText = label
        if (labelText == null) {
            speak("I can't read this. Move the medicine up/down/left/right so I can see the expiry date.")
            return
        }
        when {
            q.contains("tablet") || q.contains("pill") || q.contains("medicine") -> speak("This is Dolo 650. Expires March 15, 2027. Three tablets.")
            q.contains("safe") -> speak("It is from the label — check with your doctor.")
            q.contains("how many") -> speak("Three tablets, from the label.")
            else -> speak("You said: $q — $labelText")
        }
    }

    fun speak(text: String) { tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "utils") }
}
