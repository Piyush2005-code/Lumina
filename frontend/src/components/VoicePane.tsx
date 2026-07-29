import { useState, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { LiquidEffectAnimation } from "./ui/liquid-effect-animation.tsx";
import { VoicePoweredOrb } from "./ui/voice-powered-orb.tsx";
import { Button } from "./ui/button.tsx";
import { sendMessage } from "../lib/api.ts";

interface VoicePaneProps {
  provider: string;
  model: string;
}

export default function VoicePane({ provider, model }: VoicePaneProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [statusText, setStatusText] = useState("Click to activate voice mode");
  const [transcription, setTranscription] = useState("");
  
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Initialize WebKit Speech Recognition
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusText("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setStatusText("Listening...");
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setTranscription(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === "no-speech") {
        setStatusText("No speech detected, listening...");
      } else {
        setStatusText("Error: " + event.error);
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // If we are still supposed to be recording, it means the user finished a sentence.
      if (isRecording && transcription.trim() !== "") {
        handleUserSpeech(transcription.trim());
      } else if (isRecording) {
        // Restart if no speech was detected but we are still recording
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [isRecording, transcription]);

  useEffect(() => {
    if (isRecording) {
      setTranscription("");
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
      }
    } else {
      recognitionRef.current?.stop();
      setStatusText("Voice mode deactivated");
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    }
  }, [isRecording]);

  const handleUserSpeech = async (text: string) => {
    setStatusText("Processing...");
    // Pause recording while the model thinks and speaks
    recognitionRef.current?.stop();

    try {
      const res = await sendMessage({
        provider,
        model,
        message: text,
        history: [{ role: "system", content: "You are Lumina. Give extremely brief, conversational answers suitable for text-to-speech." }]
      });
      
      speakResponse(res.response);
    } catch (e) {
      console.error(e);
      setStatusText("Error communicating with model.");
      // Restart listening after a delay
      setTimeout(() => {
        if (isRecording) {
          setTranscription("");
          try { recognitionRef.current?.start(); } catch (e) {}
        }
      }, 2000);
    }
  };

  const speakResponse = (text: string) => {
    if (!window.speechSynthesis) {
      setStatusText("Speech synthesis not supported.");
      return;
    }

    setStatusText("Lumina is speaking...");
    isSpeakingRef.current = true;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes("en-US") && v.name.includes("Female")) || voices[0];
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (isRecording) {
        setStatusText("Listening...");
        setTranscription("");
        try { recognitionRef.current?.start(); } catch (e) {}
      } else {
        setStatusText("Voice mode deactivated");
      }
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      if (isRecording) {
        try { recognitionRef.current?.start(); } catch (e) {}
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Background */}
      <LiquidEffectAnimation />

      {/* Foreground Content */}
      <div 
        style={{ 
          position: "relative", 
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
          padding: "2rem",
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "24px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)"
        }}
      >
        <div style={{ width: 250, height: 250, position: "relative" }}>
          <VoicePoweredOrb
            enableVoiceControl={isRecording || isSpeakingRef.current}
            onVoiceDetected={setVoiceDetected}
            maxRotationSpeed={1.5}
            maxHoverIntensity={1.0}
            className="rounded-full shadow-2xl"
          />
        </div>

        <div style={{ textAlign: "center", minHeight: 80, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ 
            fontFamily: "var(--font-mono)", 
            fontSize: 14, 
            color: "rgba(255,255,255,0.9)",
            marginBottom: 8,
            letterSpacing: "0.05em",
            textTransform: "uppercase"
          }}>
            {statusText}
          </p>
          <p style={{ 
            fontFamily: "var(--font-mono)", 
            fontSize: 12, 
            color: "rgba(255,255,255,0.5)",
            maxWidth: 300,
            whiteSpace: "pre-wrap"
          }}>
            {transcription || "..."}
          </p>
        </div>

        <Button
          onClick={toggleRecording}
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          style={{ width: "100%", borderRadius: "100px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {isRecording ? (
            <>
              <MicOff size={16} className="mr-2" style={{ marginRight: 8 }} />
              Stop Session
            </>
          ) : (
            <>
              <Mic size={16} className="mr-2" style={{ marginRight: 8 }} />
              Initialize Voice
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
