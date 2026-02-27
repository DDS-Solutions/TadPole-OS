/**
 * @module VoiceClient
 * Manages Web Speech API for transcription (Listen) and text-to-speech (Speak).
 * Also supports high-fidelity audio recording for high-tier neural transcription.
 */

export class VoiceClient {
    private recognition: any = null;
    private isListening = false;
    private onTranscriptCallback: ((text: string) => void) | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];

    constructor() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event: any) => {
                const results = (event as any).results;
                const transcript = results[results.length - 1][0].transcript.trim();
                if (transcript && this.onTranscriptCallback) {
                    this.onTranscriptCallback(transcript);
                }
            };

            this.recognition.onend = () => {
                if (this.isListening) {
                    this.recognition.start(); // Keep listening if we're supposed to be
                }
            };

            this.recognition.onerror = (event: any) => {
                console.error('[VoiceClient] Recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    this.isListening = false;
                }
            };
        } else {
            console.warn('[VoiceClient] Web Speech API not supported in this browser.');
        }
    }

    startListening(callback: (text: string) => void) {
        if (!this.recognition) return;
        this.onTranscriptCallback = callback;
        this.isListening = true;
        try {
            this.recognition.start();
        } catch {
            // Silently fail if already started
        }
    }

    stopListening() {
        this.isListening = false;
        if (this.recognition) {
            this.recognition.stop();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.start();
        } catch (err) {
            console.error('[VoiceClient] Failed to start recording:', err);
        }
    }

    async stopRecording(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) return resolve(null);

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
        });
    }

    speak(text: string) {
        if (!window.speechSynthesis) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to find a nice voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Premium'));
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }
}

export const voiceClient = new VoiceClient();
