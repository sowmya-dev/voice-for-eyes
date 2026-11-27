package com.voicefor.eyes

import android.os.Bundle
import android.speech.tts.TextToSpeech
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** MVP skeleton: camera view + microphone button → transcribe (whisper.cpp stub) → VoiceLoop route (camera readout). */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(0)

        VoiceLoop.tts = TextToSpeech(this) { VoiceLoop.speak("Welcome. Open.") }

        val previewView = PreviewView(this)
        val listenButton = android.widget.Button(this).apply {
            text = "Listen (stub transcribe)"
            setOnClickListener {
                lifecycleScope.launch(Dispatchers.Default) {
                    val transcript = NativeBridge.transcribe(ByteArray(0))
                    runOnUiThread { VoiceLoop.route(transcript, NativeBridge.readLabel()) }
                }
            }
        }
        setContentView(android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            addView(previewView)
            addView(listenButton)
        })

        lifecycleScope.launch {
            val camera = ProcessCameraProvider.getInstance(this@MainActivity).get()
            camera.bindToLifecycle(this, androidx.camera.core.CameraSelector.DEFAULT_BACK_CAMERA,
                androidx.camera.core.Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) })
        }
    }
}
