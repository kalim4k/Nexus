
import { GoogleGenAI, Modality } from '@google/genai';

export class LiveSessionManager {
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private isConnected = false;

  constructor(private onStatusChange: (status: string) => void) {}

  async connect() {
    try {
      this.onStatusChange('connecting');
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });
      
      // Initialize AudioContext without specific sampleRate to match system hardware
      // This prevents the "Connecting AudioNodes from AudioContexts with different sample-rate" error
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Setup microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize Session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Tu es un modérateur expert en business et stratégie. Tu facilites une session de brainstorming vocal avec un entrepreneur. Tu parles français. Sois concis, encourageant et pertinent.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
        callbacks: {
          onopen: async () => {
            this.isConnected = true;
            this.onStatusChange('connected');
            await this.startAudioStream(stream, sessionPromise);
          },
          onmessage: async (msg) => {
            if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              this.playAudio(msg.serverContent.modelTurn.parts[0].inlineData.data);
            }
          },
          onclose: () => {
            this.isConnected = false;
            this.onStatusChange('disconnected');
          },
          onerror: (err) => {
            console.error(err);
            this.onStatusChange('error');
          }
        }
      });
      
      this.session = await sessionPromise;
      
    } catch (e) {
      console.error("Live connection failed", e);
      this.onStatusChange('error');
    }
  }

  private async startAudioStream(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.audioContext) return;
    
    // Use the existing context which matches system rate
    this.inputSource = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    const sourceSampleRate = this.audioContext.sampleRate;
    const targetSampleRate = 16000;

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Downsample to 16kHz
      const downsampledData = this.downsampleBuffer(inputData, sourceSampleRate, targetSampleRate);
      
      // Convert to PCM 16-bit
      const pcmData = this.floatTo16BitPCM(downsampledData);
      const base64Data = this.arrayBufferToBase64(pcmData);
      
      sessionPromise.then(session => {
         session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
         });
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private downsampleBuffer(buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
    if (outputSampleRate === inputSampleRate) {
      return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    
    let offsetResult = 0;
    let offsetBuffer = 0;
    
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      
      // Simple averaging for basic anti-aliasing
      let accum = 0;
      let count = 0;
      
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  private async playAudio(base64Audio: string) {
    if (!this.audioContext) return;
    
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioBuffer = await this.decodeAudioData(bytes, this.audioContext);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  private floatTo16BitPCM(float32Arr: Float32Array) {
    const buffer = new ArrayBuffer(float32Arr.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Arr.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Arr[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext) {
     // Gemini returns 24000Hz audio
     const dataInt16 = new Int16Array(data.buffer);
     const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
     const channelData = buffer.getChannelData(0);
     for (let i=0; i<dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
     }
     return buffer;
  }

  disconnect() {
    if (this.session) {
      this.session = null;
    }
    if (this.inputSource) this.inputSource.disconnect();
    if (this.processor) this.processor.disconnect();
    if (this.audioContext) this.audioContext.close();
    this.isConnected = false;
    this.onStatusChange('disconnected');
  }
}
