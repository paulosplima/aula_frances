
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, Volume2, Languages, RefreshCcw, Trophy, BookOpen, Calendar, AlertCircle, Camera, X, Check } from 'lucide-react';
import { decode, decodeAudioData, createPcmBlob } from './utils/audioUtils';
import { SessionStatus, TranscriptItem, UserProgress } from './types';

const PROGRESS_KEY = 'salut_french_progress_v2';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000;

// Component to handle face capture/upload
const FaceCustomizer: React.FC<{ onSave: (data: string) => void; onCancel: () => void }> = ({ onSave, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      alert("Não foi possível acessar a câmera.");
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/jpeg');
        setCaptured(data);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 flex flex-col items-center gap-6">
          <div className="text-center">
            <h3 className="text-2xl font-black text-slate-800">Personalizar Pierre</h3>
            <p className="text-slate-500 text-sm mt-1">Sincronize sua imagem com Pierre</p>
          </div>

          <div className="relative w-64 h-64 bg-slate-100 rounded-[2rem] overflow-hidden border-4 border-slate-50 shadow-inner">
            {!captured ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <img src={captured} className="w-full h-full object-cover scale-x-[-1]" />
            )}
            <div className="absolute inset-0 border-[20px] border-white/10 pointer-events-none rounded-[2rem]"></div>
          </div>

          <div className="flex gap-4 w-full">
            {!captured ? (
              <>
                <button onClick={onCancel} className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest text-xs transition-colors">Cancelar</button>
                <button onClick={takePhoto} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 uppercase tracking-widest text-xs">Capturar</button>
              </>
            ) : (
              <>
                <button onClick={() => { setCaptured(null); startCamera(); }} className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest text-xs transition-colors">Refazer</button>
                <button onClick={() => onSave(captured)} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-green-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"><Check size={16} /> Salvar</button>
              </>
            )}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const DefaultHumanFace = () => (
  <g>
    <defs>
      <linearGradient id="skinGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fde0c4" />
        <stop offset="100%" stopColor="#f4b183" />
      </linearGradient>
      <radialGradient id="eyeGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#4a5568" />
        <stop offset="100%" stopColor="#1a202c" />
      </radialGradient>
    </defs>
    <path d="M 55 70 C 55 30 145 30 145 70 C 145 110 130 150 100 150 C 70 150 55 110 55 70" fill="url(#skinGradient)" />
    <path d="M 100 150 C 70 150 55 110 55 70 Q 55 90 70 110 Q 100 145 100 150" fill="rgba(0,0,0,0.05)" />
    <g>
      <circle cx="82" cy="75" r="5" fill="white" />
      <circle cx="82" cy="75" r="3" fill="url(#eyeGradient)" />
      <circle cx="118" cy="75" r="5" fill="white" />
      <circle cx="118" cy="75" r="3" fill="url(#eyeGradient)" />
      <path d="M 72 68 Q 82 65 92 68" stroke="#4a5568" strokeWidth="1.5" fill="none" />
      <path d="M 108 68 Q 118 65 128 68" stroke="#4a5568" strokeWidth="1.5" fill="none" />
    </g>
    <path d="M 100 85 L 100 105 Q 100 110 105 110" stroke="#d4a373" strokeWidth="1" fill="none" opacity="0.5" />
    <path d="M 55 70 C 55 35 145 35 145 70 Q 145 60 130 45 Q 100 35 70 45 Q 55 60 55 70" fill="#2d3748" />
  </g>
);

const PierreAvatar: React.FC<{ isSpeaking: boolean; isListening: boolean; status: SessionStatus; userAvatar?: string }> = ({ isSpeaking, isListening, status, userAvatar }) => {
  const [mouthState, setMouthState] = useState(0);

  useEffect(() => {
    let interval: number;
    if (isSpeaking) {
      interval = window.setInterval(() => {
        setMouthState(Math.floor(Math.random() * 5) + 1);
      }, 75);
    } else {
      setMouthState(0);
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // Enhanced anatomical lip shapes
  const mouthConfigs = [
    { // Neutral Closed
      upper: "M 32 70 C 35 68.5 42 67.5 50 71 C 58 67.5 65 68.5 68 70 C 68 70 65 71.5 50 73 C 35 71.5 32 70 32 70 Z",
      lower: "M 32 70 C 35 71.5 42 75 50 75 C 58 75 65 71.5 68 70 C 65 75 58 79 50 79 C 42 79 35 75 32 70 Z",
      teeth: "", tongue: ""
    },
    { // Small opening
      upper: "M 32 68 C 35 66 42 63 50 66 C 58 63 65 66 68 68 C 68 68 65 69.5 50 69.5 C 35 69.5 32 68 32 68 Z",
      lower: "M 32 74 C 35 76 42 79 50 79 C 58 79 65 76 68 74 C 65 79 58 83 50 83 C 42 83 35 79 32 74 Z",
      teeth: "M 38 69.5 L 62 69.5 Q 50 71 38 69.5 Z", tongue: ""
    },
    { // Medium
      upper: "M 30 63 C 34 58 41 54 50 58 C 59 54 66 58 70 63 C 70 63 66 67 50 67 C 34 67 30 63 30 63 Z",
      lower: "M 30 81 C 34 85 41 89 50 89 C 59 89 66 85 70 81 C 66 90 59 96 50 96 C 41 96 34 90 30 81 Z",
      teeth: "M 35 67 L 65 67 Q 65 73 35 73 Z", tongue: "M 42 85 Q 50 80 58 85 Q 50 89 42 85 Z"
    },
    { // Wide
      upper: "M 28 58 C 32 48 41 43 50 48 C 59 43 68 48 72 58 C 72 58 68 65 50 65 C 32 65 28 58 28 58 Z",
      lower: "M 28 86 C 32 96 41 106 50 106 C 59 106 68 96 72 86 C 68 108 59 118 50 118 C 41 118 32 108 28 86 Z",
      teeth: "M 34 65 L 66 65 Q 66 74 34 74 Z", tongue: "M 38 98 Q 50 82 62 98 Q 50 108 38 98 Z"
    },
    { // Round
      upper: "M 40 58 C 42 53 46 52 50 55 C 54 52 58 53 60 58 L 60 63 C 54 60 46 60 40 63 Z",
      lower: "M 40 84 C 42 89 46 90 50 87 C 54 90 58 89 60 84 L 60 88 C 54 93 46 93 40 88 Z",
      teeth: "", tongue: "M 46 76 Q 50 73 54 76 Q 50 79 46 76 Z"
    },
    { // Wide Smile
      upper: "M 25 68 C 35 65 45 62 50 64 C 55 62 65 65 75 68 C 75 68 65 70 50 70 C 35 70 25 68 25 68 Z",
      lower: "M 25 75 C 35 77 45 79 50 79 C 55 79 65 77 75 75 C 65 80 55 84 50 84 C 45 84 35 80 25 75 Z",
      teeth: "M 28 70 L 72 70 Q 72 74 50 74 Q 28 74 28 70 Z", tongue: ""
    }
  ];

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full blur-[80px] opacity-30 transition-all duration-1000 ${
        isSpeaking ? 'bg-blue-400 scale-125' : isListening ? 'bg-emerald-400 scale-110' : 'bg-slate-400 scale-100'
      }`} />
      
      <div className={`relative z-10 w-full h-full transition-all duration-700 ${isSpeaking ? 'scale-105' : 'scale-100'}`}>
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_40px_80px_rgba(0,0,0,0.3)]">
          <defs>
            <linearGradient id="lipVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f29e91" />
              <stop offset="30%" stopColor="#ef5350" />
              <stop offset="100%" stopColor="#b71c1c" />
            </linearGradient>
            <filter id="lipTexture">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" />
            </filter>
            <linearGradient id="teethGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f0f0f0" />
            </linearGradient>
            <radialGradient id="mouthInterior" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4a1010" />
              <stop offset="80%" stopColor="#250606" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
          </defs>

          <g className={isSpeaking || isListening ? 'animate-pulse-slow' : ''}>
            <rect x="85" y="140" width="30" height="20" rx="4" fill="#cbd5e1" />
            
            <clipPath id="faceClip">
              <path d="M 55 70 C 55 35 145 35 145 70 C 145 115 125 150 100 150 C 75 150 55 115 55 70" />
            </clipPath>

            {userAvatar ? (
              <g>
                <path d="M 50 70 C 50 30 150 30 150 70 C 150 120 125 155 100 155 C 75 155 50 120 50 70" fill="#1e293b" />
                <image href={userAvatar} x="50" y="30" width="100" height="130" preserveAspectRatio="xMidYMid slice" clipPath="url(#faceClip)" className="scale-x-[-1] translate-x-[-200px]" />
              </g>
            ) : (
              <DefaultHumanFace />
            )}

            <g transform="translate(50, 42) scale(1.1)">
              {/* Internal Cavity */}
              {isSpeaking && (
                <path d="M 25 65 Q 50 75 75 65 L 75 110 Q 50 120 25 110 Z" fill="url(#mouthInterior)" />
              )}
              {/* Teeth */}
              {isSpeaking && mouthConfigs[mouthState].teeth && (
                <path d={mouthConfigs[mouthState].teeth} fill="url(#teethGradient)" />
              )}
              {/* Tongue */}
              {isSpeaking && mouthConfigs[mouthState].tongue && (
                <path d={mouthConfigs[mouthState].tongue} fill="#e53935" opacity="0.85" />
              )}
              {/* Upper Lip */}
              <path d={mouthConfigs[mouthState].upper} fill="url(#lipVolume)" filter="url(#lipTexture)" className="transition-all duration-75" />
              {/* Lower Lip */}
              <path d={mouthConfigs[mouthState].lower} fill="url(#lipVolume)" filter="url(#lipTexture)" className="transition-all duration-75" />
              {/* Moist reflection */}
              {isSpeaking && <path d="M 45 76 Q 50 78 55 76" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" fill="none" />}
            </g>

            <g opacity={isSpeaking || isListening ? "0.5" : "0.15"}>
               <circle cx="100" cy="95" r="88" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="4 12" />
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
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {
      sessionsCompleted: 0,
      currentLevel: 'Iniciante',
      lastLessonDate: null,
      masteredTopics: [],
      userAvatar: undefined
    };
  });
  
  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const retryCountRef = useRef(0);
  const isRetryingRef = useRef(false);
  const rollingContainerRef = useRef<HTMLDivElement>(null);

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

  const isListening = useMemo(() => status === SessionStatus.CONNECTED && !isSpeaking, [status, isSpeaking]);

  const stopSession = useCallback((updateProgress = true) => {
    isRetryingRef.current = false;
    setIsSpeaking(false);
    if (sessionRef.current) { try { sessionRef.current.close?.(); } catch (e) {} sessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(track => track.stop()); micStreamRef.current = null; }
    if (scriptProcessorRef.current) { scriptProcessorRef.current.disconnect(); scriptProcessorRef.current = null; }
    if (audioContextInRef.current) { audioContextInRef.current.close().catch(() => {}); audioContextInRef.current = null; }
    if (audioContextOutRef.current) { audioContextOutRef.current.close().catch(() => {}); audioContextOutRef.current = null; }
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
      if (outCtx.state === 'suspended') await outCtx.resume();
      if (inCtx.state === 'suspended') await inCtx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: `Você é Pierre, uma interface antropomórfica de ensino de francês.
REGRAS CRÍTICAS:
1. Comece IMEDIATAMENTE.
2. Seja proativo: diga frases, traduza e espere o aluno repetir.
3. Use feedback de voz real.
4. Use Português para gerenciar e Francês para as frases e prática.`,
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
            sessionPromise.then(session => session.sendRealtimeInput({ text: "Sincronização neural completa. Bonjour Pierre!" }));
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
                    source.buffer = audioBuffer; source.connect(ctx.destination);
                    sourcesRef.current.add(source); setIsSpeaking(true);
                    source.addEventListener('ended', () => {
                      sourcesRef.current.delete(source);
                      if (sourcesRef.current.size === 0) setIsSpeaking(false);
                    });
                    const now = ctx.currentTime;
                    if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.1;
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
            } else if (!isRetryingRef.current) { setError('Falha de conexão.'); stopSession(false); }
          },
          onclose: () => { if (!isRetryingRef.current && status === SessionStatus.CONNECTED) stopSession(); }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      if (retryCountRef.current < MAX_RETRIES) { retryCountRef.current++; setTimeout(() => startSession(true), RETRY_DELAY_BASE); }
      else { setError('Erro de sistema.'); setStatus(SessionStatus.ERROR); }
    }
  };

  const handleAvatarSave = (data: string) => {
    setProgress(prev => ({ ...prev, userAvatar: data }));
    setIsCustomizing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 overflow-hidden font-sans text-white">
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Languages size={20} />
          </div>
          <h1 className="text-lg font-black tracking-tight italic">Salut!<span className="text-blue-500">Pierre</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setIsCustomizing(true)} className="px-3 py-1.5 bg-slate-800 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-700">
            <Camera size={12} className="inline mr-1" /> SINC
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/20 text-blue-400 rounded-full text-[9px] font-black border border-blue-900/50 uppercase tracking-widest">
            <Trophy size={12} /> LVL {progress.currentLevel}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 flex flex-col items-center justify-start gap-2 overflow-hidden">
        
        {/* AVATAR TOP POSITION */}
        <div className="w-full flex justify-center py-2 animate-in slide-in-from-top-4 duration-700">
          <PierreAvatar isSpeaking={isSpeaking} isListening={isListening} status={status} userAvatar={progress.userAvatar} />
        </div>

        {/* TRANSCRIPTION SECTION - ELEVATED */}
        {(status !== SessionStatus.IDLE || transcripts.length > 0) && (
          <div className="w-full max-w-3xl flex flex-col gap-2 relative mt-[-20px]">
            <div 
              ref={rollingContainerRef}
              className="h-[50vh] overflow-y-auto scrollbar-hide flex flex-col gap-4 px-6 py-8 mask-fade-edges relative z-10"
            >
              {transcripts.length === 0 && status === SessionStatus.CONNECTED && (
                <p className="text-center text-slate-500 italic font-medium animate-pulse mt-8">Estabelecendo canal linguístico...</p>
              )}
              {transcripts.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 ${item.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[90%] px-6 py-4 rounded-[1.5rem] text-xl md:text-2xl font-bold leading-snug tracking-tight shadow-lg ${
                    item.role === 'user' 
                      ? 'bg-blue-600/10 text-blue-300 border border-blue-900/50' 
                      : 'bg-slate-900/60 text-white border-l-8 border-blue-500 pl-8'
                  }`}>
                    {item.text}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mt-2 px-4">
                    {item.role === 'user' ? 'VOUS' : 'PIERRE'}
                  </span>
                </div>
              ))}
              {status === SessionStatus.CONNECTING && (
                <div className="flex items-center gap-4 justify-center py-10 opacity-60">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></div>
                  <p className="text-xs font-black uppercase tracking-[0.4em]">Sincronizando Pierre...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* IDLE LANDING - HIGHER POSITION */}
        {status === SessionStatus.IDLE && transcripts.length === 0 && (
          <div className="flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in duration-700 py-10">
             <div className="flex gap-4 mb-4">
               {[
                 { label: 'Sessões', val: progress.sessionsCompleted },
                 { label: 'Fluência', val: progress.currentLevel }
               ].map((st, i) => (
                 <div key={i} className="bg-slate-900/50 px-5 py-3 rounded-2xl border border-slate-800 backdrop-blur-sm">
                   <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{st.label}</div>
                   <div className="text-xl font-black text-blue-400">{st.val}</div>
                 </div>
               ))}
             </div>
             <p className="text-slate-400 text-lg max-w-sm mb-4">
               Inicie uma conversa em tempo real para praticar sua pronúncia.
             </p>
             <button
                onClick={() => startSession()}
                className="group bg-blue-600 hover:bg-blue-500 text-white font-black py-6 px-12 rounded-[2rem] shadow-2xl transition-all active:scale-95 flex items-center gap-4 text-2xl uppercase tracking-widest"
              >
                <Mic size={28} /> CONECTAR
              </button>
          </div>
        )}

        {error && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-sm p-4 z-[60]">
            <div className="bg-red-500/90 backdrop-blur-md text-white p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-red-400">
              <AlertCircle size={24} className="flex-shrink-0" />
              <p className="font-bold text-sm flex-1">{error}</p>
              <button onClick={() => startSession()} className="p-2 bg-white/20 rounded-full"><RefreshCcw size={16} /></button>
            </div>
          </div>
        )}
      </main>

      {/* COMPACT FOOTER CONTROLS */}
      <div className="fixed bottom-0 left-0 right-0 p-6 md:p-10 z-50 flex justify-center pointer-events-none">
        {status !== SessionStatus.IDLE && (
          <div className="pointer-events-auto">
            <button
              onClick={() => stopSession()}
              className="bg-red-600 hover:bg-red-500 text-white p-6 rounded-full shadow-2xl transition-all active:scale-90 relative"
            >
              <MicOff size={32} />
              <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping opacity-20"></div>
            </button>
          </div>
        )}
      </div>

      {isCustomizing && <FaceCustomizer onSave={handleAvatarSave} onCancel={() => setIsCustomizing(false)} />}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-fade-edges {
          mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
        }
        @keyframes pulse-slow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.02); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
