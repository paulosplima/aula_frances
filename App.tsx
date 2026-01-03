
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Languages, RefreshCcw, Trophy, AlertCircle, Volume2 } from 'lucide-react';
import { decode, decodeAudioData, createPcmBlob } from './utils/audioUtils';
import { SessionStatus, TranscriptItem, UserProgress } from './types';

const PROGRESS_KEY = 'salut_french_progress_v3';

// PierreAvatar: High-precision lip-sync component
const PierreAvatar: React.FC<{ 
  isSpeaking: boolean; 
  isListening: boolean; 
  analyser: AnalyserNode | null;
}> = ({ isSpeaking, isListening, analyser }) => {
  const [mouthState, setMouthState] = useState(0);
  const smoothedVolumeRef = useRef(0);

  // Animation loop for precise lip-sync
  useEffect(() => {
    let rafId: number;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);

    const updateMouth = () => {
      if (isSpeaking && analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const targetVolume = average / 128; // Normalize to 0-2 range roughly

        // Smooth the volume transitions (decay slower than rise)
        if (targetVolume > smoothedVolumeRef.current) {
          smoothedVolumeRef.current = targetVolume;
        } else {
          smoothedVolumeRef.current += (targetVolume - smoothedVolumeRef.current) * 0.2;
        }

        const vol = smoothedVolumeRef.current;
        if (vol < 0.08) setMouthState(0);
        else if (vol < 0.25) setMouthState(1);
        else if (vol < 0.50) setMouthState(4);
        else if (vol < 0.80) setMouthState(6);
        else if (vol < 1.10) setMouthState(2);
        else setMouthState(3);
      } else {
        smoothedVolumeRef.current = 0;
        setMouthState(0);
      }
      rafId = requestAnimationFrame(updateMouth);
    };

    rafId = requestAnimationFrame(updateMouth);
    return () => cancelAnimationFrame(rafId);
  }, [isSpeaking, analyser]);

  // Viseme configurations for SVG paths
  const mouthConfigs = [
    { // 0: Closed
      upper: "M 32 72 C 34 68 42 65 50 71 C 58 65 66 68 68 72 C 68 73.5 50 75 32 72 Z",
      lower: "M 32 72 C 34 76 44 86 50 86 C 56 86 66 76 68 72 C 65 91 50 98 35 91 C 33 88 32 82 32 72 Z",
      teeth: "", tongue: ""
    },
    { // 1: Slightly Open
      upper: "M 34 74 C 36 71 44 70 50 74 C 56 70 64 71 66 74 C 64 76 50 76.5 34 74 Z",
      lower: "M 34 74 C 36 78 44 82 50 82 C 56 82 64 78 66 74 C 63 88 50 92 37 88 C 35 85 34 81 34 74 Z",
      teeth: "", tongue: ""
    },
    { // 2: Wide Open
      upper: "M 30 64 C 33 50 44 46 50 54 C 56 46 67 50 70 64 C 65 71 50 73 35 71 C 32 68 30 66 30 64 Z",
      lower: "M 30 84 C 34 108 44 118 50 118 C 56 118 66 108 70 84 C 65 128 50 138 35 128 C 32 118 30 108 30 84 Z",
      teeth: "M 34 72 L 66 72 Q 66 79 34 79 Z", tongue: "M 40 110 Q 50 94 60 110 Q 50 122 40 110 Z"
    },
    { // 3: Max Open
      upper: "M 28 60 C 32 44 44 40 50 52 C 56 40 68 44 72 60 C 68 68 50 70 32 68 C 30 64 28 62 28 60 Z",
      lower: "M 28 88 C 32 112 44 125 50 125 C 56 125 68 112 72 88 C 68 138 50 148 32 138 C 30 125 28 110 28 88 Z",
      teeth: "M 33 70 L 67 70 Q 67 78 33 78 Z", tongue: "M 38 118 Q 50 98 62 118 Q 50 133 38 118 Z"
    },
    { // 4: Rounded
      upper: "M 25 70 C 35 62 45 60 50 64 C 55 60 65 62 75 70 C 65 74 50 76 35 74 C 30 72 25 71 25 70 Z",
      lower: "M 25 78 C 35 80 45 84 50 84 C 55 84 65 80 75 78 C 65 95 50 102 35 95 C 30 90 25 85 25 78 Z",
      teeth: "M 28 75 L 72 75 Q 72 81 50 81 Q 28 81 28 75 Z", tongue: ""
    },
    { // 5: Small 'O'
      upper: "M 42 66 C 44 58 48 57 50 61 C 52 57 56 58 58 66 L 58 72 C 54 70 46 70 42 72 Z",
      lower: "M 42 84 C 44 92 48 93 50 90 C 52 93 56 92 58 84 L 58 90 C 54 98 46 98 42 90 Z",
      teeth: "", tongue: ""
    },
    { // 6: Wide Smile
      upper: "M 32 68 C 34 62 44 61 50 66 C 56 61 66 62 68 68 C 65 71 50 73 35 71 Z",
      lower: "M 32 74 C 35 76 45 80 50 80 C 55 80 65 76 68 74 C 65 84 50 87 35 84 Z",
      teeth: "M 34 68 L 66 68 L 66 75 C 50 78 34 75 L 34 68 Z", tongue: ""
    }
  ];

  const currentMouth = mouthConfigs[mouthState];

  return (
    <div className="relative w-full max-w-sm h-40 mx-auto flex items-center justify-center overflow-visible">
      <div className={`relative z-10 w-full h-full transition-transform duration-300 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible drop-shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <defs>
            <linearGradient id="lipGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="35%" stopColor="#ef4444" />
              <stop offset="85%" stopColor="#881313" />
            </linearGradient>
            <radialGradient id="mouthDeep" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#450a0a" />
              <stop offset="100%" stopColor="#1a0404" />
            </radialGradient>
          </defs>

          {/* Avatar Face Container (Optional subtle base) */}
          <circle cx="100" cy="100" r="80" fill="#fef3c7" opacity="0.1" />

          {/* Mouth Group: Adjusted for Top-Alignment */}
          <g transform="translate(50, -40) scale(1.4)">
            {/* Interior */}
            {isSpeaking && (
              <path d="M 25 65 Q 50 85 75 65 L 75 130 Q 50 145 25 130 Z" fill="url(#mouthDeep)" />
            )}
            
            {/* Components */}
            {currentMouth.teeth && <path d={currentMouth.teeth} fill="#f8fafc" opacity="0.9" />}
            {currentMouth.tongue && <path d={currentMouth.tongue} fill="#991b1b" />}
            
            {/* Lips */}
            <path d={currentMouth.lower} fill="url(#lipGradient)" className="transition-all duration-75 ease-out" />
            <path d={currentMouth.upper} fill="url(#lipGradient)" className="transition-all duration-75 ease-out" />
          </g>
        </svg>
      </div>
      {isListening && (
        <div className="absolute inset-0 flex items-center justify-center -translate-y-12">
          <div className="w-40 h-40 rounded-full border-4 border-blue-400/30 animate-ping" />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {
      sessionsCompleted: 0,
      currentLevel: 'Iniciante',
      lastLessonDate: null,
      masteredTopics: [],
    };
  });

  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [transcript]);

  const addTranscriptItem = useCallback((role: 'user' | 'model', text: string) => {
    setTranscript(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      role,
      text,
      timestamp: Date.now()
    }]);
  }, []);

  const handleStop = useCallback(() => {
    if (sessionRef.current) { sessionRef.current.close(); sessionRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setStatus(SessionStatus.IDLE);
    setIsSpeaking(false);
    setAnalyser(null);
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setStatus(SessionStatus.CONNECTING);
      setError(null);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const audioContextIn = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const audioContextOut = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextInRef.current = audioContextIn;
      audioContextOutRef.current = audioContextOut;

      // Audio Chain for High Volume on Mobile
      const analyserNode = audioContextOut.createAnalyser();
      analyserNode.fftSize = 256;
      setAnalyser(analyserNode);
      outputAnalyserRef.current = analyserNode;

      const gainNode = audioContextOut.createGain();
      gainNode.gain.value = 15.0; // Significant boost
      outputGainRef.current = gainNode;

      const compressor = audioContextOut.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, audioContextOut.currentTime);
      compressor.knee.setValueAtTime(30, audioContextOut.currentTime);
      compressor.ratio.setValueAtTime(12, audioContextOut.currentTime);

      gainNode.connect(compressor);
      compressor.connect(analyserNode);
      analyserNode.connect(audioContextOut.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let currentInputTranscription = '';
      let currentOutputTranscription = '';

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus(SessionStatus.CONNECTED);
            const source = audioContextIn.createMediaStreamSource(stream);
            const scriptProcessor = audioContextIn.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextIn.destination);
            sessionPromise.then(session => session.sendRealtimeInput({ text: "Bonjour!" }));
          },
          onmessage: async (message) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription) addTranscriptItem('user', currentInputTranscription);
              if (currentOutputTranscription) addTranscriptItem('model', currentOutputTranscription);
              currentInputTranscription = '';
              currentOutputTranscription = '';
            }

            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData) {
                  const audioData = part.inlineData.data;
                  setIsSpeaking(true);
                  const buffer = await decodeAudioData(decode(audioData), audioContextOut, 24000, 1);
                  const source = audioContextOut.createBufferSource();
                  source.buffer = buffer;
                  source.connect(gainNode);
                  
                  const startTime = Math.max(nextStartTimeRef.current, audioContextOut.currentTime);
                  source.start(startTime);
                  nextStartTimeRef.current = startTime + buffer.duration;
                  
                  sourcesRef.current.add(source);
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) setIsSpeaking(false);
                  };
                }
              }
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onerror: (e) => {
            setError('Falha ao iniciar tutor. Verifique sua conexão.');
            handleStop();
          },
          onclose: () => handleStop()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `Você é Pierre, um professor de francês minimalista.
            REGRAS:
            1. Seja encorajador e direto.
            2. Ensine frases úteis para iniciantes.
            3. Use o português apenas se necessário.
            4. Se o aluno repetir corretamente, elogie-o.`
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      setError('Falha ao acessar o microfone.');
      setStatus(SessionStatus.ERROR);
    }
  }, [addTranscriptItem, handleStop]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Absolute Top Header */}
      <header className="p-4 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <Languages size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Salut! Pierre</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-blue-400">
          <Trophy size={14} /> XP: {progress.sessionsCompleted * 100}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start relative px-4 pt-4">
        {/* Pierre at the absolute top (relative to main) */}
        <div className="w-full max-w-sm animate-in slide-in-from-top-10 duration-700">
          <PierreAvatar 
            isSpeaking={isSpeaking} 
            isListening={status === SessionStatus.CONNECTED && !isSpeaking} 
            analyser={analyser} 
          />
        </div>

        {/* Content Area */}
        <div className="w-full max-w-2xl flex-1 flex flex-col gap-4 mt-[-40px]">
          {status === SessionStatus.IDLE && transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-6 animate-in fade-in zoom-in-95">
              <h2 className="text-3xl font-black text-white leading-tight">Prêt pour votre cours?</h2>
              <p className="text-slate-400 max-w-xs">Aprenda francês conversando em tempo real com Pierre. Toque abaixo para começar.</p>
              <button
                onClick={handleStart}
                className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-full shadow-[0_20px_40px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center gap-4 text-xl uppercase tracking-widest"
              >
                <Mic size={24} /> Começar
              </button>
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-2 space-y-6 pb-24 scrollbar-hide mask-fade-bottom"
            >
              {transcript.map((item) => (
                <div key={item.id} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                  <div className={`max-w-[85%] px-6 py-4 rounded-3xl text-lg font-medium shadow-xl ${
                    item.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none border border-white/10' 
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'
                  }`}>
                    {item.text}
                  </div>
                </div>
              ))}
              {status === SessionStatus.CONNECTING && (
                <div className="flex items-center justify-center py-10 gap-3 text-blue-400">
                  <RefreshCcw className="animate-spin" />
                  <span className="font-bold uppercase tracking-widest text-xs">Bonjour Pierre...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="fixed top-24 left-4 right-4 bg-red-500/90 backdrop-blur-xl p-4 rounded-2xl flex items-center gap-4 text-white font-bold border border-red-400/50 shadow-2xl z-50">
            <AlertCircle />
            <span className="flex-1">{error}</span>
            <button onClick={() => setStatus(SessionStatus.IDLE)} className="p-2 bg-white/20 rounded-full"><RefreshCcw size={16}/></button>
          </div>
        )}
      </main>

      {/* Persistent Controls */}
      {status !== SessionStatus.IDLE && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center px-8 z-50 pointer-events-none">
          <button
            onClick={handleStop}
            className="pointer-events-auto bg-red-600/90 hover:bg-red-500 text-white p-6 rounded-full shadow-[0_15px_30px_rgba(220,38,38,0.4)] transition-all active:scale-90 group"
          >
            <MicOff size={32} />
          </button>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .mask-fade-bottom {
          mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
        }
      `}</style>
    </div>
  );
};

export default App;
