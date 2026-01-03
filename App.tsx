
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
      <radialGradient id="faceSpherical" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#f8d1b1" />
        <stop offset="40%" stopColor="#f3b88c" />
        <stop offset="80%" stopColor="#d98c5f" />
        <stop offset="100%" stopColor="#b36c45" />
      </radialGradient>
      
      <linearGradient id="hairDepth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#444" />
        <stop offset="60%" stopColor="#111" />
        <stop offset="100%" stopColor="#000" />
      </linearGradient>

      <linearGradient id="glassesRim3D" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#333" />
        <stop offset="50%" stopColor="#0a0a0a" />
        <stop offset="100%" stopColor="#222" />
      </linearGradient>

      <filter id="soft3DShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="8" stdDeviation="5" shadowColor="#000000" shadowOpacity="0.4" />
      </filter>
    </defs>
    
    <path d="M 85 140 Q 100 155 115 140 L 115 175 Q 100 185 85 175 Z" fill="#9c5b36" />
    <path d="M 85 140 Q 100 152 115 140" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="4" />

    <circle cx="54" cy="100" r="14" fill="#d98c5f" />
    <circle cx="146" cy="100" r="14" fill="#d98c5f" />

    <path d="M 55 70 C 55 30 145 30 145 70 C 145 125 125 160 100 160 C 75 160 55 125 55 70" fill="url(#faceSpherical)" filter="url(#soft3DShadow)" />
    
    <g fill="#222" opacity="0.9" filter="url(#soft3DShadow)">
      <path d="M 70 120 Q 100 115 130 120 Q 130 135 100 130 Q 70 135 70 120 Z" />
      <path d="M 92 138 L 108 138 L 100 150 Z" />
      <path d="M 82 155 Q 100 168 118 155 L 122 162 Q 100 175 78 162 Z" />
      <path d="M 55 100 Q 60 145 80 160 M 145 100 Q 140 145_120 160" stroke="#222" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.6" />
    </g>

    <g>
      <ellipse cx="82" cy="94" rx="8" ry="7" fill="white" />
      <circle cx="82" cy="94" r="4" fill="#3b2416" />
      <circle cx="83.5" cy="92" r="1.8" fill="white" opacity="0.9" />
      
      <ellipse cx="118" cy="94" rx="8" ry="7" fill="white" />
      <circle cx="118" cy="94" r="4" fill="#3b2416" />
      <circle cx="119.5" cy="92" r="1.8" fill="white" opacity="0.9" />
    </g>

    <g filter="url(#soft3DShadow)">
      <g fill="none" stroke="url(#glassesRim3D)" strokeWidth="5">
        <rect x="62" y="82" width="38" height="26" rx="9" />
        <rect x="100" y="82" width="38" height="26" rx="9" />
        <path d="M 98 94 Q 100 90 102 94" strokeWidth="4" />
      </g>
      <circle cx="66" cy="86" r="1.5" fill="white" opacity="0.4" />
      <circle cx="134" cy="86" r="1.5" fill="white" opacity="0.4" />
      <path d="M 70 88 Q 80 88 90 92" stroke="white" strokeWidth="3" opacity="0.15" strokeLinecap="round" fill="none" />
      <path d="M 110 88 Q 120 88 130 92" stroke="white" strokeWidth="3" opacity="0.15" strokeLinecap="round" fill="none" />
      <g opacity="0.8">
        <path d="M 59 92 L 63 92 M 61 90 L 61 94" stroke="white" strokeWidth="1" />
        <path d="M 137 92 L 141 92 M 139 90 L 139 94" stroke="white" strokeWidth="1" />
      </g>
    </g>

    <g filter="url(#soft3DShadow)">
      <path d="M 55 70 C 50 45 60 25 100 20 C 140 25 150 45 145 70" fill="url(#hairDepth)" />
      <path d="M 70 28 L 82 12 L 95 24" fill="#111" />
      <path d="M 92 22 L 108 8 L 122 24" fill="#000" />
      <path d="M 115 20 L 135 12 L 145 35" fill="#111" />
      <path d="M 75 25 Q 100 15 125 25" stroke="rgba(255,255,255,0.1)" strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
    
    <path d="M 100 95 L 94 118 Q 100 125 106 118 Z" fill="#9c5b36" opacity="0.3" />
  </g>
);

const PierreAvatar: React.FC<{ isSpeaking: boolean; isListening: boolean; status: SessionStatus; userAvatar?: string }> = ({ isSpeaking, isListening, status, userAvatar }) => {
  const [mouthState, setMouthState] = useState(0);

  useEffect(() => {
    let interval: number;
    if (isSpeaking) {
      interval = window.setInterval(() => {
        setMouthState(Math.floor(Math.random() * 8));
      }, 75);
    } else {
      setMouthState(0);
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  const mouthConfigs = [
    { 
      upper: "M 32 72 C 34 68 44 65 50 71 C 56 65 66 68 68 72 C 68 73 50 75 32 72 Z",
      lower: "M 32 72 C 34 76 44 84 50 84 C 56 84 66 76 68 72 C 64 88 50 94 36 88 C 34 85 32 80 32 72 Z",
      teeth: "", tongue: ""
    },
    { 
      upper: "M 32 68 C 34 62 44 60 50 67 C 56 60 66 62 68 68 C 65 71 50 74 35 71 C 33 70 32 69 32 68 Z",
      lower: "M 32 78 C 34 85 44 92 50 92 C 56 92 66 85 68 78 C 65 94 50 102 35 94 C 33 90 32 85 32 78 Z",
      teeth: "M 38 72 L 62 72 Q 50 75 38 72 Z", tongue: ""
    },
    { 
      upper: "M 42 62 C 43 54 48 53 50 58 C 52 53 57 54 58 62 L 58 70 C 53 64 47 64 42 70 Z",
      lower: "M 42 88 C 43 96 48 97 50 91 C 52 97 57 96 58 88 L 58 94 C 53 103 47 103 42 94 Z",
      teeth: "", tongue: "M 46 80 Q 50 77 54 80 Q 50 84 46 80 Z"
    },
    { 
      upper: "M 28 64 C 32 50 42 45 50 55 C 58 45 68 50 72 64 C 68 70 50 72 32 70 C 30 68 28 66 28 64 Z",
      lower: "M 28 86 C 32 105 42 115 50 115 C 58 115 68 105 72 86 C 68 122 50 132 32 122 C 30 115 28 105 28 86 Z",
      teeth: "M 34 71 L 66 71 Q 66 78 34 78 Z", tongue: "M 38 105 Q 50 85 62 105 Q 50 118 38 105 Z"
    },
    { 
      upper: "M 25 70 C 35 62 45 60 50 64 C 55 60 65 62 75 70 C 65 74 50 76 35 74 C 30 72 25 71 25 70 Z",
      lower: "M 25 78 C 35 80 45 84 50 84 C 55 84 65 80 75 78 C 65 95 50 102 35 95 C 30 90 25 85 25 78 Z",
      teeth: "M 28 75 L 72 75 Q 72 80 50 80 Q 28 80 28 75 Z", tongue: ""
    },
    { 
      upper: "M 40 66 C 42 59 47 58 50 61 C 53 58 58 59 60 66 L 60 72 C 53 69 47 69 40 72 Z",
      lower: "M 40 84 C 42 90 47 91 50 87 C 53 91 58 90 60 84 L 60 88 C 53 94 47 94 40 88 Z",
      teeth: "", tongue: ""
    },
    { 
      upper: "M 32 68 C 34 62 44 61 50 66 C 56 61 66 62 68 68 C 65 71 50 73 35 71 Z",
      lower: "M 32 80 C 34 86 44 92 50 92 C 56 92 66 86 68 80 C 65 96 50 104 35 96 Z",
      teeth: "M 34 70 L 66 70 Q 66 74 34 74 Z", tongue: "M 40 88 Q 50 78 60 88"
    },
    { 
      upper: "M 28 71 C 35 66 45 64 50 68 C 55 64 65 66 72 71 C 65 73 50 75 35 73 Z",
      lower: "M 28 75 C 35 77 45 80 50 80 C 55 80 65 77 72 75 C 65 85 50 90 35 85 Z",
      teeth: "M 30 72 L 70 72 Q 70 76 50 76 Z", tongue: ""
    }
  ];

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full blur-[100px] opacity-40 transition-all duration-1000 ${
        isSpeaking ? 'bg-blue-400 scale-125' : isListening ? 'bg-emerald-400 scale-110' : 'bg-slate-400 scale-100'
      }`} />
      
      <div className={`relative z-10 w-full h-full transition-all duration-700 ${isSpeaking ? 'scale-105' : 'scale-100'}`}>
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_45px_100px_rgba(0,0,0,0.6)]">
          <defs>
            <linearGradient id="lipGradientReal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="30%" stopColor="#ef4444" />
              <stop offset="80%" stopColor="#991b1b" />
              <stop offset="100%" stopColor="#450a0a" />
            </linearGradient>
            <radialGradient id="lipMoist" cx="50%" cy="30%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0.5" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <filter id="lipTextureFine">
              <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" />
            </filter>
            <linearGradient id="teethSSS" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#efefef" />
            </linearGradient>
            <radialGradient id="oralVoid" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#450a0a" />
              <stop offset="85%" stopColor="#1a0404" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <radialGradient id="sphericalBG" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="60%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#172554" />
            </radialGradient>
          </defs>

          <g className={isSpeaking || isListening ? 'animate-pulse-slow' : ''}>
            <circle cx="100" cy="100" r="92" fill="url(#sphericalBG)" />
            <clipPath id="faceClip">
              <path d="M 55 70 C 55 35 145 35 145 70 C 145 115 125 150 100 150 C 75 150 55 115 55 70" />
            </clipPath>
            {userAvatar ? (
              <g>
                <path d="M 50 70 C 50 30 150 30 150 70 C 150 120 125 155 100 155 C 75 155 50 120 50 70" fill="#1e293b" />
                <image href={userAvatar} x="50" y="30" width="100" height="130" preserveAspectRatio="xMidYMid slice" clipPath="url(#faceClip)" className="scale-x-[-2] translate-x-[-300px]" />
              </g>
            ) : (
              <DefaultHumanFace />
            )}
            <g transform="translate(50, 72) scale(1.05)">
              <circle cx="32" cy="74" r="4" fill="black" opacity="0.1" filter="blur(2px)" />
              <circle cx="68" cy="74" r="4" fill="black" opacity="0.1" filter="blur(2px)" />
              {isSpeaking && (
                <path d="M 25 65 Q 50 78 75 65 L 75 118 Q 50 128 25 118 Z" fill="url(#oralVoid)" />
              )}
              {isSpeaking && mouthConfigs[mouthState].teeth && (
                <path d={mouthConfigs[mouthState].teeth} fill="url(#teethSSS)" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
              )}
              {isSpeaking && mouthConfigs[mouthState].tongue && (
                <path d={mouthConfigs[mouthState].tongue} fill="#cc1e1e" opacity="0.95" />
              )}
              <path d={mouthConfigs[mouthState].upper} fill="url(#lipGradientReal)" filter="url(#lipTextureFine)" className="transition-all duration-100" />
              <path d={mouthConfigs[mouthState].upper} fill="url(#lipMoist)" opacity="0.2" className="transition-all duration-100" />
              <path d={mouthConfigs[mouthState].lower} fill="url(#lipGradientReal)" filter="url(#lipTextureFine)" className="transition-all duration-100" />
              <path d={mouthConfigs[mouthState].lower} fill="url(#lipMoist)" opacity="0.3" className="transition-all duration-100" />
              {isSpeaking && (
                <g opacity="0.4">
                   <path d="M 44 79 Q 50 81 56 79" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" />
                   <path d="M 40 90 Q 50 93 60 90" stroke="white" strokeWidth="0.6" strokeLinecap="round" fill="none" />
                   <circle cx="35" cy="85" r="0.5" fill="white" />
                   <circle cx="65" cy="85" r="0.5" fill="white" />
                </g>
              )}
              <path d="M 40 98 Q 50 102 60 98" fill="none" stroke="black" strokeWidth="1" opacity="0.1" filter="blur(1px)" />
            </g>
            <g opacity={isSpeaking || isListening ? "0.3" : "0.05"}>
               <circle cx="100" cy="100" r="96" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="1 10" />
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
          systemInstruction: `Você é Pierre, uma interface 3D realista de ensino de francês.
DIRETRIZES:
1. Comece IMEDIATAMENTE após a conexão.
2. Diga uma frase em francês, dê a tradução em português e peça para o aluno repetir.
3. Avalie o áudio recebido e dê feedback construtivo.
4. Mantenha uma atitude encorajadora e profissional.`,
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
            sessionPromise.then(session => session.sendRealtimeInput({ text: "Interface 3D sincronizada. Bonjour Pierre!" }));
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
            } else if (!isRetryingRef.current) { setError('Falha no motor gráfico.'); stopSession(false); }
          },
          onclose: () => { if (!isRetryingRef.current && status === SessionStatus.CONNECTED) stopSession(); }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      if (retryCountRef.current < MAX_RETRIES) { retryCountRef.current++; setTimeout(() => startSession(true), RETRY_DELAY_BASE); }
      else { setError('Erro crítico de inicialização.'); setStatus(SessionStatus.ERROR); }
    }
  };

  const handleAvatarSave = (data: string) => {
    setProgress(prev => ({ ...prev, userAvatar: data }));
    setIsCustomizing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05060b] overflow-hidden font-sans text-white">
      <header className="bg-slate-900/40 backdrop-blur-2xl border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.5)]">
            <Languages size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tight italic">Pierre<span className="text-blue-500 font-normal ml-1">3D</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setIsCustomizing(true)} className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2">
            <Camera size={14} /> SINC
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black border border-blue-500/20 uppercase tracking-widest shadow-inner">
            <Trophy size={14} /> XP: {progress.sessionsCompleted * 150}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 flex flex-col items-center justify-start gap-0 overflow-hidden relative">
        
        <div className="w-full flex justify-center py-4 animate-in slide-in-from-top-20 duration-1000 z-10">
          <PierreAvatar isSpeaking={isSpeaking} isListening={isListening} status={status} userAvatar={progress.userAvatar} />
        </div>

        {(status !== SessionStatus.IDLE || transcripts.length > 0) && (
          <div className="w-full max-w-3xl flex flex-col gap-2 relative -mt-10 flex-1">
            <div 
              ref={rollingContainerRef}
              className="h-full max-h-[50vh] overflow-y-auto scrollbar-hide flex flex-col gap-6 px-6 py-10 mask-fade-edges relative z-10"
            >
              {transcripts.length === 0 && status === SessionStatus.CONNECTED && (
                <div className="flex flex-col items-center gap-4 mt-12">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
                   <p className="text-center text-blue-500/40 italic font-bold tracking-widest text-xs uppercase">Conexão 3D Ativa</p>
                </div>
              )}
              <div className="flex flex-col gap-6 pb-24">
                {transcripts.map((item) => (
                  <div 
                    key={item.id} 
                    className={`flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-1000 ${item.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[92%] px-8 py-6 rounded-[2.5rem] text-2xl md:text-3xl font-black leading-tight tracking-tight shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-3xl ${
                      item.role === 'user' 
                        ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30' 
                        : 'bg-white/5 text-white border-l-[12px] border-blue-600 pl-10'
                    }`}>
                      {item.text}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-700 mt-3 px-6">
                      {item.role === 'user' ? 'L’ÉLÈVE' : 'MAÎTRE PIERRE'}
                    </span>
                  </div>
                ))}
              </div>
              {status === SessionStatus.CONNECTING && (
                <div className="flex items-center gap-4 justify-center py-12 opacity-60">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
                  <p className="text-xs font-black uppercase tracking-[0.8em] text-blue-500 animate-pulse">Initializing Pierre...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {status === SessionStatus.IDLE && transcripts.length === 0 && (
          <div className="flex flex-col items-center text-center gap-10 animate-in fade-in zoom-in-95 duration-1000 py-10">
             <div className="flex gap-6 mb-4">
               {[
                 { label: 'Sessões', val: progress.sessionsCompleted },
                 { label: 'Fluência', val: progress.currentLevel }
               ].map((st, i) => (
                 <div key={i} className="bg-white/5 px-8 py-5 rounded-[2rem] border border-white/10 backdrop-blur-xl shadow-2xl">
                   <div className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] mb-1">{st.label}</div>
                   <div className="text-3xl font-black text-blue-400">{st.val}</div>
                 </div>
               ))}
             </div>
             <div className="flex flex-col items-center gap-4">
                <h2 className="text-4xl font-black tracking-tighter italic">Bem-vindo à Experiência 3D.</h2>
                <p className="text-slate-500 text-lg max-w-sm font-medium leading-relaxed">
                  Conecte-se para começar sua prática intensiva de francês com Pierre em tempo real.
                </p>
             </div>
             <button
                onClick={() => startSession()}
                className="group relative bg-blue-600 hover:bg-blue-500 text-white font-black py-8 px-20 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(37,99,235,0.8)] transition-all active:scale-90 flex items-center gap-6 text-3xl uppercase tracking-[0.3em] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <Mic size={36} className="group-hover:scale-110 transition-transform" /> ENTRAR
              </button>
          </div>
        )}

        {error && (
          <div className="fixed top-28 left-1/2 -translate-x-1/2 w-full max-w-sm p-4 z-[70]">
            <div className="bg-red-500/90 backdrop-blur-2xl text-white p-8 rounded-[2rem] shadow-[0_30px_100px_rgba(239,68,68,0.5)] flex items-center gap-6 border border-red-400/50">
              <AlertCircle size={32} className="flex-shrink-0" />
              <div className="flex-1">
                 <p className="font-black uppercase tracking-widest text-[10px] mb-1 opacity-60">System Alert</p>
                 <p className="font-bold text-sm leading-tight">{error}</p>
              </div>
              <button onClick={() => startSession()} className="p-3 bg-white/20 rounded-full hover:bg-white/40 transition-colors"><RefreshCcw size={20} /></button>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 z-50 flex justify-center pointer-events-none">
        {status !== SessionStatus.IDLE && (
          <div className="pointer-events-auto">
            <button
              onClick={() => stopSession()}
              className="bg-red-600/90 hover:bg-red-600 text-white p-4 rounded-full shadow-[0_15px_40px_rgba(239,68,68,0.5)] transition-all active:scale-75 group backdrop-blur-3xl border border-white/20 relative"
            >
              <MicOff size={24} />
              <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-ping opacity-10 pointer-events-none"></div>
              <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all shadow-xl whitespace-nowrap border border-white/10 scale-75 group-hover:scale-100 origin-bottom">
                Déconnecter Pierre
              </span>
            </button>
          </div>
        )}
      </div>

      {isCustomizing && <FaceCustomizer onSave={handleAvatarSave} onCancel={() => setIsCustomizing(false)} />}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-fade-edges {
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 80%, transparent 100%);
        }
        @keyframes pulse-3d {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); filter: brightness(1); }
          50% { transform: translateY(-12px) scale(1.05) rotate(1deg); filter: brightness(1.2) contrast(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-3d 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
