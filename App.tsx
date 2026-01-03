
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, Volume2, Languages, RefreshCcw, Trophy, BookOpen, Calendar, AlertCircle, Camera, X, Check } from 'lucide-react';
import { decode, decodeAudioData, createPcmBlob } from './utils/audioUtils';
import { SessionStatus, TranscriptItem, UserProgress } from './types';

const PROGRESS_KEY = 'salut_french_progress_v2';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000;

const PierreAvatar: React.FC<{ 
  isSpeaking: boolean; 
  isListening: boolean; 
  status: SessionStatus; 
  voiceVolume?: number; 
}> = ({ isSpeaking, isListening, status, voiceVolume = 0 }) => {
  const [mouthState, setMouthState] = useState(0);

  // Sync mouth state to voice volume
  useEffect(() => {
    if (isSpeaking) {
      if (voiceVolume < 0.05) setMouthState(0);
      else if (voiceVolume < 0.15) setMouthState(1); 
      else if (voiceVolume < 0.30) setMouthState(6); 
      else if (voiceVolume < 0.45) setMouthState(7); 
      else if (voiceVolume < 0.60) setMouthState(5); 
      else if (voiceVolume < 0.75) setMouthState(4); 
      else if (voiceVolume < 0.90) setMouthState(2); 
      else setMouthState(3);
    } else {
      setMouthState(0);
    }
  }, [isSpeaking, voiceVolume]);

  const mouthConfigs = [
    { 
      upper: "M 32 72 C 34 68 42 65 50 71 C 58 65 66 68 68 72 C 68 73.5 50 75 32 72 Z",
      lower: "M 32 72 C 34 76 44 86 50 86 C 56 86 66 76 68 72 C 65 91 50 98 35 91 C 33 88 32 82 32 72 Z",
      teeth: "", tongue: ""
    },
    { 
      upper: "M 34 74 C 36 71 44 70 50 74 C 56 70 64 71 66 74 C 64 76 50 76.5 34 74 Z",
      lower: "M 34 74 C 36 78 44 82 50 82 C 56 82 64 78 66 74 C 63 88 50 92 37 88 C 35 85 34 81 34 74 Z",
      teeth: "", tongue: ""
    },
    { 
      upper: "M 30 64 C 33 50 44 46 50 54 C 56 46 67 50 70 64 C 65 71 50 73 35 71 C 32 68 30 66 30 64 Z",
      lower: "M 30 84 C 34 108 44 118 50 118 C 56 118 66 108 70 84 C 65 128 50 138 35 128 C 32 118 30 108 30 84 Z",
      teeth: "M 34 72 L 66 72 Q 66 79 34 79 Z", tongue: "M 40 110 Q 50 94 60 110 Q 50 122 40 110 Z"
    },
    { 
      upper: "M 28 60 C 32 44 44 40 50 52 C 56 40 68 44 72 60 C 68 68 50 70 32 68 C 30 64 28 62 28 60 Z",
      lower: "M 28 88 C 32 112 44 125 50 125 C 56 125 68 112 72 88 C 68 138 50 148 32 138 C 30 125 28 110 28 88 Z",
      teeth: "M 33 70 L 67 70 Q 67 78 33 78 Z", tongue: "M 38 118 Q 50 98 62 118 Q 50 133 38 118 Z"
    },
    { 
      upper: "M 25 70 C 35 62 45 60 50 64 C 55 60 65 62 75 70 C 65 74 50 76 35 74 C 30 72 25 71 25 70 Z",
      lower: "M 25 78 C 35 80 45 84 50 84 C 55 84 65 80 75 78 C 65 95 50 102 35 95 C 30 90 25 85 25 78 Z",
      teeth: "M 28 75 L 72 75 Q 72 81 50 81 Q 28 81 28 75 Z", tongue: ""
    },
    { 
      upper: "M 42 66 C 44 58 48 57 50 61 C 52 57 56 58 58 66 L 58 72 C 54 70 46 70 42 72 Z",
      lower: "M 42 84 C 44 92 48 93 50 90 C 52 93 56 92 58 84 L 58 90 C 54 98 46 98 42 90 Z",
      teeth: "", tongue: ""
    },
    { 
      upper: "M 32 68 C 34 62 44 61 50 66 C 56 61 66 62 68 68 C 65 71 50 73 35 71 Z",
      lower: "M 32 74 C 35 76 45 80 50 80 C 55 80 65 76 68 74 C 65 84 50 87 35 84 Z",
      teeth: "M 34 68 L 66 68 L 66 75 C 50 78 34 75 L 34 68 Z", tongue: ""
    },
    { 
      upper: "M 30 68 C 32 62 42 60 50 66 C 58 60 68 62 70 68 C 65 72 50 74 35 72 Z",
      lower: "M 30 82 C 34 89 44 95 50 95 C 56 95 66 89 70 82 C 65 104 50 112 35 104 Z",
      teeth: "M 33 71 L 67 71 Q 50 76 33 71 Z", tongue: "M 42 89 Q 50 81 58 89"
    }
  ];

  return (
    <div className="relative w-full max-w-sm h-64 mx-auto flex items-start justify-center overflow-visible">
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-[100px] opacity-20 transition-all duration-1000 ${
        isSpeaking ? 'bg-blue-400' : isListening ? 'bg-emerald-400' : 'bg-slate-800'
      }`} />
      
      <div className={`relative z-10 w-full h-full transition-all duration-700 ${isSpeaking ? 'scale-105' : 'scale-100'}`}>
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible drop-shadow-[0_25px_60px_rgba(0,0,0,0.5)]">
          <defs>
            <linearGradient id="lipGradientFine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="35%" stopColor="#ef4444" />
              <stop offset="85%" stopColor="#881313" />
              <stop offset="100%" stopColor="#450a0a" />
            </linearGradient>

            <radialGradient id="lipSpecular" cx="50%" cy="30%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0.45" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            
            <filter id="lipRealisticFilter">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" />
            </filter>

            <linearGradient id="teethShaded" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#d1d5db" />
            </linearGradient>

            <radialGradient id="mouthInteriorDeep" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#450a0a" />
              <stop offset="85%" stopColor="#1a0404" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
          </defs>

          <g className={isSpeaking || isListening ? 'animate-pulse-slow' : ''}>
            {/* ONLY MOUTH - 1.5x Larger, positioned high in the SVG (translate Y lowered significantly) */}
            <g transform="translate(50, -25) scale(1.6)">
              {/* Deep Oral Cavity */}
              {isSpeaking && (
                <path d="M 25 65 Q 50 82 75 65 L 75 128 Q 50 138 25 128 Z" fill="url(#mouthInteriorDeep)" />
              )}
              
              {/* Dynamic Teeth */}
              {isSpeaking && mouthConfigs[mouthState].teeth && (
                <path d={mouthConfigs[mouthState].teeth} fill="url(#teethShaded)" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" />
              )}
              
              {/* Dynamic Tongue */}
              {isSpeaking && mouthConfigs[mouthState].tongue && (
                <path d={mouthConfigs[mouthState].tongue} fill="#cc1e1e" opacity="0.95" />
              )}
              
              {/* Upper Lip */}
              <path d={mouthConfigs[mouthState].upper} fill="url(#lipGradientFine)" filter="url(#lipRealisticFilter)" className="transition-all duration-75 ease-out" />
              <path d={mouthConfigs[mouthState].upper} fill="url(#lipSpecular)" opacity="0.25" className="transition-all duration-75" />
              
              {/* Lower Lip */}
              <path d={mouthConfigs[mouthState].lower} fill="url(#lipGradientFine)" filter="url(#lipRealisticFilter)" className="transition-all duration-75 ease-out" />
              <path d={mouthConfigs[mouthState].lower} fill="url(#lipSpecular)" opacity="0.38" className="transition-all duration-75" />
              
              {/* Moisture Highlights */}
              {isSpeaking && (
                <g opacity="0.55">
                   <path d="M 44 76 Q 50 78 56 76" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none" />
                   <path d="M 40 90 Q 50 93 60 90" stroke="white" strokeWidth="0.7" strokeLinecap="round" fill="none" />
                </g>
              )}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {
      sessionsCompleted: 0,
      currentLevel: 'Iniciante',
      lastLessonDate: null,
      masteredTopics: [],
    };
  });
  
  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const retryCountRef = useRef(0);
  const isRetryingRef = useRef(false);
  const rollingContainerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (rollingContainerRef.current) {
      rollingContainerRef.current.scrollTo({
        top: rollingContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcripts]);

  // Audio volume detection loop for lip-syncing
  useEffect(() => {
    const detectVolume = () => {
      if (outputAnalyserRef.current) {
        const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setVoiceVolume(average / 128); 
      }
      rafIdRef.current = requestAnimationFrame(detectVolume);
    };
    rafIdRef.current = requestAnimationFrame(detectVolume);
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current); };
  }, []);

  const isListening = useMemo(() => status === SessionStatus.CONNECTED && !isSpeaking, [status, isSpeaking]);

  const stopSession = useCallback((updateProgress = true) => {
    isRetryingRef.current = false;
    setIsSpeaking(false);
    setVoiceVolume(0);
    if (sessionRef.current) { try { sessionRef.current.close?.(); } catch (e) {} sessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(track => track.stop()); micStreamRef.current = null; }
    if (scriptProcessorRef.current) { scriptProcessorRef.current.disconnect(); scriptProcessorRef.current = null; }
    if (audioContextInRef.current) { audioContextInRef.current.close().catch(() => {}); audioContextInRef.current = null; }
    if (audioContextOutRef.current) { audioContextOutRef.current.close().catch(() => {}); audioContextOutRef.current = null; }
    outputAnalyserRef.current = null;
    outputGainRef.current = null;
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (updateProgress && status === SessionStatus.CONNECTED) {
      setProgress(prev => ({
        ...prev,
        sessionsCompleted: prev.sessionsCompleted + 1,
        currentLevel: prev.sessionsCompleted + 1 > 20 ? 'Avançado' : prev.sessionsCompleted + 1 > 5 ? 'Intermediário' : 'Iniciante',
        lastLessonDate: new Date().toLocaleDateString('pt-BR')
      }));
    }
    setStatus(SessionStatus.IDLE);
  }, [status]);

  const startSession = async (retry: boolean = false) => {
    if (!retry) { retryCountRef.current = 0; isRetryingRef.current = false; }
    try {
      setStatus(SessionStatus.CONNECTING);
      setError(null);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextInRef.current = inCtx; audioContextOutRef.current = outCtx;
      
      const analyser = outCtx.createAnalyser();
      analyser.fftSize = 256;
      const gainNode = outCtx.createGain();
      
      // Increased volume boost for mobile devices (3.0x gain) to fix low volume
      gainNode.gain.value = 3.0; 
      
      gainNode.connect(analyser);
      analyser.connect(outCtx.destination);
      outputGainRef.current = gainNode;
      outputAnalyserRef.current = analyser;

      if (outCtx.state === 'suspended') await outCtx.resume();
      if (inCtx.state === 'suspended') await inCtx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: `Você é Pierre, uma interface minimalista de ensino de francês representada apenas por uma boca expressiva.
DIRETRIZES:
1. Comece IMEDIATAMENTE após a conexão.
2. Diga uma frase em francês, dê a tradução em português e peça para o aluno repetir.
3. Avalie o áudio recebido e dê feedback construtivo.
4. Mantenha uma atitude encorajadora e profissional.
5. Se o aluno não falar nada por um tempo, encoraje-o gentilmente.`,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(SessionStatus.CONNECTED); retryCountRef.current = 0; isRetryingRef.current = false;
            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inCtx.destination);
            sessionPromise.then(session => session.sendRealtimeInput({ text: "Bonjour Pierre! Estou pronto para praticar." }));
          },
          onmessage: async (message) => {
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && audioContextOutRef.current) {
              const ctx = audioContextOutRef.current;
              for (const part of parts) {
                if (part.inlineData) {
                  const base64Audio = part.inlineData.data;
                  if (!base64Audio) continue;
                  try {
                    const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer; 
                    if (outputGainRef.current) source.connect(outputGainRef.current);
                    else source.connect(ctx.destination);

                    sourcesRef.current.add(source); setIsSpeaking(true);
                    source.addEventListener('ended', () => {
                      sourcesRef.current.delete(source);
                      if (sourcesRef.current.size === 0) setIsSpeaking(false);
                    });
                    const now = ctx.currentTime;
                    if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                  } catch (err) { console.error(err); }
                }
              }
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear(); setIsSpeaking(false);
              nextStartTimeRef.current = audioContextOutRef.current?.currentTime || 0;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              const userTxt = currentInputTranscription.current.trim();
              const modelTxt = currentOutputTranscription.current.trim();
              if (userTxt || modelTxt) {
                setTranscripts(prev => [
                  ...prev,
                  ...(userTxt ? [{ id: Date.now().toString() + '-u', role: 'user' as const, text: userTxt, timestamp: Date.now() }] : []),
                  ...(modelTxt ? [{ id: Date.now().toString() + '-m', role: 'model' as const, text: modelTxt, timestamp: Date.now() }] : []),
                ]);
              }
              currentInputTranscription.current = ''; currentOutputTranscription.current = '';
            }
          },
          onerror: (e: any) => {
            if (retryCountRef.current < MAX_RETRIES && !isRetryingRef.current) {
              isRetryingRef.current = true; retryCountRef.current++; stopSession(false);
              setTimeout(() => startSession(true), RETRY_DELAY_BASE);
            } else if (!isRetryingRef.current) { setError('Conexão instável.'); stopSession(false); }
          },
          onclose: () => { if (!isRetryingRef.current && status === SessionStatus.CONNECTED) stopSession(); }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      if (retryCountRef.current < MAX_RETRIES) { retryCountRef.current++; setTimeout(() => startSession(true), RETRY_DELAY_BASE); }
      else { setError('Falha ao conectar com o tutor.'); setStatus(SessionStatus.ERROR); }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05060b] overflow-hidden font-sans text-white">
      <header className="bg-slate-900/40 backdrop-blur-2xl border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.5)]">
            <Languages size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tight italic">Salut!<span className="text-blue-500 font-normal ml-1">Live</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black border border-blue-500/20 uppercase tracking-widest shadow-inner">
            <Trophy size={14} /> XP: {progress.sessionsCompleted * 150}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 flex flex-col items-center justify-start gap-0 overflow-hidden relative">
        
        <div className="w-full flex justify-center py-0 animate-in slide-in-from-top-20 duration-1000 z-10">
          <PierreAvatar 
            isSpeaking={isSpeaking} 
            isListening={isListening} 
            status={status} 
            voiceVolume={voiceVolume}
          />
        </div>

        {(status !== SessionStatus.IDLE || transcripts.length > 0) && (
          <div className="w-full max-w-3xl flex flex-col gap-2 relative -mt-4 flex-1">
            <div 
              ref={rollingContainerRef}
              className="h-full max-h-[55vh] overflow-y-auto scrollbar-hide flex flex-col gap-6 px-6 py-10 mask-fade-edges relative z-10"
            >
              {transcripts.length === 0 && status === SessionStatus.CONNECTED && (
                <div className="flex flex-col items-center gap-4 mt-20">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
                   <p className="text-center text-blue-500/40 italic font-bold tracking-widest text-xs uppercase">Pierre está te ouvindo...</p>
                </div>
              )}
              <div className="flex flex-col gap-6 pb-24">
                {transcripts.map((item) => (
                  <div 
                    key={item.id} 
                    className={`flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-1000 ${item.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[92%] px-8 py-6 rounded-[2.5rem] text-xl md:text-3xl font-black leading-tight tracking-tight shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-3xl ${
                      item.role === 'user' 
                        ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30' 
                        : 'bg-white/5 text-white border-l-[12px] border-blue-600 pl-10'
                    }`}>
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
              {status === SessionStatus.CONNECTING && (
                <div className="flex items-center gap-4 justify-center py-20 opacity-60">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
                  <p className="text-xs font-black uppercase tracking-[0.8em] text-blue-500 animate-pulse">Iniciando Pierre...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {status === SessionStatus.IDLE && transcripts.length === 0 && (
          <div className="flex flex-col items-center text-center gap-10 animate-in fade-in zoom-in-95 duration-1000 py-20">
             <div className="flex flex-col items-center gap-4 mt-12">
                <h2 className="text-4xl font-black tracking-tighter italic text-center">Fale francês fluentemente.</h2>
                <p className="text-slate-500 text-lg max-w-sm font-medium leading-relaxed">
                  Pratique sua pronúncia e conversação em tempo real com Pierre.
                </p>
             </div>
             <button
                onClick={() => startSession()}
                className="group relative bg-blue-600 hover:bg-blue-500 text-white font-black py-8 px-20 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(37,99,235,0.8)] transition-all active:scale-90 flex items-center gap-6 text-3xl uppercase tracking-[0.3em] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <Mic size={36} className="group-hover:scale-110 transition-transform" /> COMEÇAR
              </button>
          </div>
        )}

        {error && (
          <div className="fixed top-28 left-1/2 -translate-x-1/2 w-full max-w-sm p-4 z-[70]">
            <div className="bg-red-500/90 backdrop-blur-2xl text-white p-8 rounded-[2rem] shadow-[0_30px_100px_rgba(239,68,68,0.5)] flex items-center gap-6 border border-red-400/50">
              <AlertCircle size={32} className="flex-shrink-0" />
              <div className="flex-1">
                 <p className="font-black uppercase tracking-widest text-[10px] mb-1 opacity-60">Alerta</p>
                 <p className="font-bold text-sm leading-tight">{error}</p>
              </div>
              <button onClick={() => startSession()} className="p-3 bg-white/20 rounded-full hover:bg-white/40 transition-colors"><RefreshCcw size={20} /></button>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-8 z-50 flex justify-center pointer-events-none">
        {status !== SessionStatus.IDLE && (
          <div className="pointer-events-auto">
            <button
              onClick={() => stopSession()}
              className="bg-red-600/90 hover:bg-red-600 text-white p-6 rounded-full shadow-[0_15px_40px_rgba(239,68,68,0.5)] transition-all active:scale-75 group backdrop-blur-3xl border border-white/20"
            >
              <MicOff size={32} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-fade-edges {
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 80%, transparent 100%);
        }
        @keyframes pulse-3d {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
          50% { transform: translateY(-5px) scale(1.02) rotate(0.5deg); }
        }
        .animate-pulse-slow {
          animation: pulse-3d 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
