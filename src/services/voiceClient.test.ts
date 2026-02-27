import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VoiceClient } from './voiceClient';

describe('VoiceClient', () => {
    let voiceClient: VoiceClient;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock SpeechRecognition
        const mockSpeechRecognition = vi.fn().mockImplementation(function (this: any) {
            this.start = vi.fn();
            this.stop = vi.fn();
            this.onresult = null;
            this.onend = null;
            this.onerror = null;
            this.continuous = false;
            this.interimResults = false;
            this.lang = '';
        });
        (window as any).SpeechRecognition = mockSpeechRecognition;
        (window as any).webkitSpeechRecognition = mockSpeechRecognition;

        // Mock MediaRecorder
        const mockMediaStream = {
            getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
        };
        (global as any).navigator.mediaDevices = {
            getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
        };

        const mockMediaRecorder = vi.fn().mockImplementation(function (this: any) {
            this.start = vi.fn();
            this.stop = vi.fn();
            this.ondataavailable = null;
            this.onstop = null;
            this.stream = mockMediaStream;
        });
        (global as any).MediaRecorder = mockMediaRecorder;

        // Mock SpeechSynthesis
        (global as any).window.speechSynthesis = {
            speak: vi.fn(),
            cancel: vi.fn(),
            getVoices: vi.fn().mockReturnValue([
                { name: 'Google US English', lang: 'en-US' },
                { name: 'Samantha', lang: 'en-US' }
            ])
        };
        const mockUtterance = vi.fn().mockImplementation(function (this: any, text: string) {
            this.text = text;
            this.rate = 1;
            this.pitch = 1;
            this.volume = 1;
            this.voice = null;
        });
        (global as any).SpeechSynthesisUtterance = mockUtterance;

        voiceClient = new VoiceClient();
    });

    it('should initialize SpeechRecognition', () => {
        expect((window as any).SpeechRecognition).toHaveBeenCalled();
    });

    it('should start and stop listening', () => {
        const spy = vi.spyOn((voiceClient as any).recognition, 'start');
        const stopSpy = vi.spyOn((voiceClient as any).recognition, 'stop');

        voiceClient.startListening(() => { });
        expect(spy).toHaveBeenCalled();

        voiceClient.stopListening();
        expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle speech transcription via callback', () => {
        const callback = vi.fn();
        voiceClient.startListening(callback);

        // Simulate onresult event
        const mockEvent = {
            results: [
                [{ transcript: 'hello world' }]
            ]
        };
        (voiceClient as any).recognition.onresult(mockEvent);

        expect(callback).toHaveBeenCalledWith('hello world');
    });

    it('should start and stop recording', async () => {
        await voiceClient.startRecording();
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
        expect(global.MediaRecorder).toHaveBeenCalled();

        const recorder = (voiceClient as any).mediaRecorder;
        const stopSpy = vi.spyOn(recorder, 'stop');

        const stopPromise = voiceClient.stopRecording();

        // Simulate data available and then stop
        recorder.ondataavailable({ data: new Blob(['test'], { type: 'audio/wav' }) });
        recorder.onstop();

        const result = await stopPromise;
        expect(stopSpy).toHaveBeenCalled();
        expect(result).toBeInstanceOf(Blob);
    });

    it('should perform text-to-speech', () => {
        voiceClient.speak('Hello from Tadpole');

        expect(window.speechSynthesis.cancel).toHaveBeenCalled();
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
        expect(global.SpeechSynthesisUtterance).toHaveBeenCalledWith('Hello from Tadpole');
    });
});
