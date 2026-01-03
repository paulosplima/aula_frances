
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
            <p className="text-slate-500 text-sm mt-1">Crie seu tutor personalizado com seu rosto</p>
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

// Realistic "Public Persona" SVG for the Android Tutor
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
    {/* Head Base */}
    <path d="M 55 70 C 55 30 145 30 145 70 C 145 110 130 150 100 150 C 70 150 55 110 55 70" fill="url(#skinGradient)" />
    {/* Subtle Shadows */}
    <path d="M 100 150 C 70 150 55 110 55 70 Q 55 90 70 110 Q 100 145 100 150" fill="rgba(0,0,0,0.05)" />
    {/* Eyes */}
    <g>
      <circle cx="82" cy="75" r="5" fill="white" />
      <circle cx="82" cy="75" r="3" fill="url(#eyeGradient)" />
      <circle cx="118" cy="75" r="5" fill="white" />
      <circle cx="118" cy="75" r="3" fill="url(#eyeGradient)" />
      {/* Brows */}
      <path d="M 72 68 Q 82 65 92 68" stroke="#4a5568" strokeWidth="1.5" fill="none" />
      <path d="M 108 68 Q 118 65 128 68" stroke="#4a5568" strokeWidth="1.5" fill="none" />
    </g>
    {/* Nose */}
    <path d="M 100 85 L 100 105 Q 100 110 105 110" stroke="#d4a373" strokeWidth="1" fill="none" opacity="0.5" />
    {/* Hair (Short/Professional) */}
    <path d="M 55 70 C 55 35 145 35 145 70 Q 145 60 130 45 Q 100 35 70 45 Q 55 60 55 70" fill="#2d3748" />
  </g>
);

// Advanced Humanoid Avatar with Lip Sync and Optional User Face
const PierreAvatar: React.FC<{ isSpeaking: boolean; isListening: boolean; status: SessionStatus; userAvatar?: string }> = ({ isSpeaking, isListening, status, userAvatar }) => {
  const [mouthState, setMouthState] = useState(0);

  useEffect(() => {
    let interval: number;
    if (isSpeaking) {
      interval = window.setInterval(() => {
        setMouthState(Math.floor(Math.random() * 6));
      }, 80);
    } else {
      setMouthState(0);
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  const mouthPaths = [
    "M 44 72 Q 50 72 56 72", // 0: Resting
    "M 45 71 Q 50 74 55 71", // 1: Slight opening
    "M 43 70 Q 50 78 57 70", // 2: Medium opening
    "M 42 69 Q 50 84 58 69", // 3: Wide opening
    "M 46 69 Q 50 78 54 69 Q 50 82 46 69", // 4: 'O' shape (vowels)
    "M 44 71 L 56 71 Q 50 74 44 71" // 5: 'E' shape (teeth shown)
  ];

  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full blur-[80px] opacity-25 transition-all duration-1000 ${
        isSpeaking ? 'bg-blue-400 scale-125' : isListening ? 'bg-emerald-400 scale-110' : 'bg-slate-400 scale-100'
      }`} />
      
      <div className={`relative z-10 w-full h-full transition-all duration-700 ${isSpeaking ? 'scale-105' : 'scale-100'}`}>
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.2)]">
          <g className={isSpeaking || isListening ? 'animate-pulse-slow' : ''}>
            {/* Base Structure / Neck */}
            <rect x="85" y="140" width="30" height="20" rx="4" fill="#cbd5e1" />
            
            {/* Face Container */}
            <defs>
              <clipPath id="faceClip">
                <path d="M 55 70 C 55 35 145 35 145 70 C 145 115 125 150 100 150 C 75 150 55 115 55 70" />
              </clipPath>
            </defs>

            {userAvatar ? (
              <g>
                <path d="M 50 70 C 50 30 150 30 150 70 C 150 120 125 155 100 155 C 75 155 50 120 50 70" fill="#1e293b" />
                <image 
                  href={userAvatar} 
                  x="50" y="30" width="100" height="130" 
                  preserveAspectRatio="xMidYMid slice" 
                  clipPath="url(#faceClip)"
                  className="scale-x-[-1] translate-x-[-200px]"
                />
              </g>
            ) : (
              <DefaultHumanFace />
            )}

            {/* Android Detailings */}
            <g opacity="0.15">
              <path d="M 55 90 L 145 90" stroke="#000" strokeWidth="0.5" />
              <path d="M 100 35 L 100 150" stroke="#000" strokeWidth="0.5" />
            </g>

            {/* Dynamic Lip-Synced Mouth Overlay */}
            <g transform="translate(50, 48) scale(1.05)">
              {/* Mouth Interior Background */}
              {isSpeaking && (
                <path 
                  d={mouthPaths[mouthState]} 
                  fill="rgba(255, 255, 255, 0.2)"
                  className="transition-all duration-75"
                />
              )}
              {/* Lips */}
              <path 
                d={mouthPaths[mouthState]} 
                stroke={isSpeaking ? "#ef4444" : "#d19a71"} 
                strokeWidth="2.5" 
                fill="none" 
                strokeLinecap="round" 
                className="transition-all duration-75"
              />
            </g>

            {/* HUD Overlays */}
            <g opacity={isSpeaking || isListening ? "0.6" : "0.2"} className="transition-opacity duration-500">
               <circle cx="100" cy="95" r="75" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2 6" />
               <path d="M 30 95 L 45 95 M 155 95 L 170 95" stroke="#3b82f6" strokeWidth="1" />
            </g>

            {/* Interactive Scanning Overlay */}
            <rect x="50" y="30" width="100" height="130" fill="url(#scanline)" clipPath="url(#faceClip)" opacity="0.1" />
          </g>

          <defs>
            <linearGradient id="scanline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="transparent" />
              <animate attributeName="y1" values="-1;1" dur="4s" repeatCount="indefinite" />
              <animate attributeName="y2" values="0;2" dur="4s" repeatCount="indefinite" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <div className={`px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_10px_40px_rgba(0,0,0,0.2)] border backdrop-blur-xl transition-all duration-700 ${
          isSpeaking 
            ? 'bg-blue-600 text-white border-blue-400 scale-110 shadow-blue-500/40' 
            : isListening 
              ? 'bg-emerald-500 text-white border-emerald-400' 
              : 'bg-white/95 text-slate-500 border-slate-200'
        }`}>
          {isSpeaking ? 'Pierre Enseigne' : isListening ? 'Analyse Vocale' : 'Interface Active'}
        </div>
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

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  const isListening = useMemo(() => status === SessionStatus.CONNECTED && !isSpeaking, [status, isSpeaking]);

  const stopSession = useCallback((updateProgress = true) => {
    isRetryingRef.current = false;
    setIsSpeaking(false);
    
    if (sessionRef.current) {
      try { sessionRef.current.close?.(); } catch (e) {}
      sessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextInRef.current) {
      audioContextInRef.current.close().catch(() => {});
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close().catch(() => {});
      audioContextOutRef.current = null;
    }
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
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
    if (!retry) {
      retryCountRef.current = 0;
      isRetryingRef.current = false;
    }

    try {
      setStatus(SessionStatus.CONNECTING);
      setError(null);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextInRef.current = inCtx;
      audioContextOutRef.current = outCtx;

      if (outCtx.state === 'suspended') await outCtx.resume();
      if (inCtx.state === 'suspended') await inCtx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `Você é Pierre, uma interface antropomórfica de ensino de francês.
Você possui um rosto humano sintetizado de uso público que transmite amizade e clareza.

REGRAS CRÍTICAS:
1. Inicie a aula IMEDIATAMENTE com uma saudação calorosa em francês.
2. Seja proativo e falante: se o aluno hesitar, ajude-o com a pronúncia.
3. Pronuncie frases em francês com perfeição, peça para o usuário repetir e dê feedback real sobre o que ouviu.
4. Use Português para gerenciar e ensinar, Francês para praticar.

Pierre, ative seus circuitos e comece agora!`,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(SessionStatus.CONNECTED);
            retryCountRef.current = 0; 
            isRetryingRef.current = false;
            
            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(() => {});
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);

            sessionPromise.then(session => {
              session.sendRealtimeInput({ text: "Interface sincronizada. Bonjour Pierre! Estou pronto para aprender." });
            });
          },
          onmessage: async (message) => {
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && audioContextOutRef.current) {
              const ctx = audioContextOutRef.current;
              for (const part of parts) {
                if (part.inlineData) {
                  const base64Audio = part.inlineData.data;
                  if (!base64Audio) continue;
                  if (ctx.state === 'suspended') await ctx.resume();

                  try {
                    const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    
                    sourcesRef.current.add(source);
                    setIsSpeaking(true);
                    
                    source.addEventListener('ended', () => {
                      sourcesRef.current.delete(source);
                      if (sourcesRef.current.size === 0) setIsSpeaking(false);
                    });

                    const now = ctx.currentTime;
                    if (nextStartTimeRef.current < now) {
                      nextStartTimeRef.current = now + 0.12; 
                    }
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                  } catch (err) {
                    console.error('Playback fail:', err);
                  }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              setIsSpeaking(false);
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
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }
          },
          onerror: (e: any) => {
            if (retryCountRef.current < MAX_RETRIES && !isRetryingRef.current) {
              isRetryingRef.current = true;
              retryCountRef.current++;
              stopSession(false);
              setTimeout(() => startSession(true), RETRY_DELAY_BASE);
            } else if (!isRetryingRef.current) {
              setError('Conexão instável. Tente novamente.');
              stopSession(false);
            }
          },
          onclose: () => {
            if (!isRetryingRef.current && status === SessionStatus.CONNECTED) stopSession();
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setTimeout(() => startSession(true), RETRY_DELAY_BASE);
      } else {
        setError('Falha crítica de comunicação.');
        setStatus(SessionStatus.ERROR);
      }
    }
  };

  const handleAvatarSave = (data: string) => {
    setProgress(prev => ({ ...prev, userAvatar: data }));
    setIsCustomizing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100">
            <Languages size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight italic">Salut!<span className="text-blue-600">Sync</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsCustomizing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-white transition-all shadow-sm active:scale-95"
          >
            <Camera size={14} />
            Visão
          </button>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black border border-blue-100 uppercase tracking-widest">
            <Trophy size={14} />
            LVL {progress.currentLevel}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6 overflow-hidden">
        
        {(status !== SessionStatus.IDLE || transcripts.length > 0) && (
          <div className="w-full flex justify-center py-4 md:py-10">
            <PierreAvatar isSpeaking={isSpeaking} isListening={isListening} status={status} userAvatar={progress.userAvatar} />
          </div>
        )}

        {status === SessionStatus.IDLE && transcripts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-2xl mx-auto w-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
              {[
                { label: 'Sincronias', val: progress.sessionsCompleted, icon: <BookOpen />, color: 'orange' },
                { label: 'Ranking', val: progress.currentLevel, icon: <Trophy />, color: 'blue' },
                { label: 'Atividade', val: progress.lastLessonDate || '--/--', icon: <Calendar />, color: 'purple' }
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-1 items-center hover:scale-[1.02] transition-transform">
                  <div className={`bg-${item.color}-100 w-14 h-14 rounded-2xl flex items-center justify-center text-${item.color}-600 mb-4`}>
                    {item.icon}
                  </div>
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.label}</div>
                  <div className="text-xl font-black text-slate-800">{item.val}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center text-center space-y-5 pt-8">
              <PierreAvatar isSpeaking={false} isListening={false} status={SessionStatus.IDLE} userAvatar={progress.userAvatar} />
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-slate-800 tracking-tight">Voulez-vous pratiquer?</h2>
                <p className="text-slate-500 max-w-sm leading-relaxed text-lg font-medium">
                  Pratique sua pronúncia francesa com Pierre, sua interface sintética de ensino.
                </p>
              </div>
            </div>

            <button
              onClick={() => startSession()}
              className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-black py-8 px-12 rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-4 text-2xl uppercase tracking-[0.2em]"
            >
              <Mic size={28} />
              INICIAR
            </button>
          </div>
        )}

        {(status !== SessionStatus.IDLE || transcripts.length > 0) && (
          <div className="flex-1 flex flex-col gap-5 overflow-y-auto pb-52 scrollbar-hide px-2">
            {transcripts.map((item) => (
              <div key={item.id} className={`flex flex-col max-w-[85%] ${item.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className={`px-7 py-5 rounded-[2rem] text-sm md:text-base transition-all duration-300 shadow-sm ${
                  item.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100 font-medium' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none font-medium'
                }`}>
                  {item.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-2.5 font-black uppercase tracking-[0.3em] px-3 opacity-50">
                  {item.role === 'user' ? 'ENTRADA VOCAL' : 'SAÍDA PIERRE'}
                </span>
              </div>
            ))}
            {status === SessionStatus.CONNECTING && (
              <div className="flex flex-col items-center justify-center py-16 gap-7 bg-white/40 rounded-[3rem] border border-dashed border-slate-200 backdrop-blur-sm">
                <div className="flex space-x-4">
                  <div className="w-5 h-5 bg-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-200"></div>
                  <div className="w-5 h-5 bg-blue-500 rounded-full animate-bounce [animation-delay:-.3s] shadow-lg shadow-blue-200"></div>
                  <div className="w-5 h-5 bg-blue-500 rounded-full animate-bounce [animation-delay:-.5s] shadow-lg shadow-blue-200"></div>
                </div>
                <p className="text-xs text-slate-500 font-black uppercase tracking-[0.4em] animate-pulse">
                  ALINHANDO MATRIZES DE ÁUDIO...
                </p>
              </div>
            )}
            <div id="anchor" className="h-10"></div>
          </div>
        )}

        {error && (
          <div className="fixed bottom-36 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-50">
            <div className="bg-red-500 text-white p-7 rounded-[2rem] flex items-center gap-6 shadow-2xl shadow-red-200 border border-red-400 animate-in fade-in slide-in-from-bottom-6">
              <AlertCircle size={36} />
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 opacity-80">Protocolo de Erro</p>
                <p className="text-base font-bold leading-tight">{error}</p>
              </div>
              <button onClick={() => startSession()} className="bg-white/20 p-3 rounded-full hover:bg-white/30 transition-colors">
                <RefreshCcw size={22} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-3xl border-t border-slate-100 p-9 pb-12 shadow-[0_-40px_80px_-20px_rgba(0,0,0,0.1)] z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-8">
          <div className="hidden md:flex items-center gap-5">
             <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-700 ${status === SessionStatus.CONNECTED ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200' : 'bg-slate-100 text-slate-300'}`}>
               <Volume2 size={32} />
             </div>
             <div>
               <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Status Neural</div>
               <div className="text-sm font-bold text-slate-600 tracking-tight">
                 {status === SessionStatus.CONNECTED ? (isSpeaking ? 'PIERRE EM SÍNTESE' : 'MODO ESCUTA ATIVO') : 'SISTEMA EM ESPERA'}
               </div>
             </div>
          </div>

          <div className="flex-1 md:flex-none flex justify-center relative">
            {status === SessionStatus.IDLE ? (
              <button
                onClick={() => startSession()}
                className="bg-blue-600 hover:bg-blue-700 text-white p-9 rounded-full shadow-[0_25px_60px_rgba(37,99,235,0.4)] transition-all active:scale-90 hover:scale-105"
              >
                <Mic size={40} />
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <button
                  onClick={() => stopSession()}
                  className="bg-red-500 hover:bg-red-600 text-white p-9 rounded-full shadow-[0_25px_60px_rgba(239,68,68,0.3)] transition-all active:scale-90 relative z-10"
                >
                  <MicOff size={40} />
                </button>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-red-100 rounded-full animate-ping opacity-10"></div>
                <span className="text-[11px] font-black text-red-500 mt-5 tracking-[0.4em] uppercase">Encerrar</span>
              </div>
            )}
          </div>

          <div className="hidden sm:flex flex-col items-end">
             <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mb-3">Ranking de Fluência</div>
             <div className="flex gap-2.5">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`w-10 h-2.5 rounded-full transition-all duration-1000 ${i <= (progress.sessionsCompleted % 5 || (progress.sessionsCompleted > 0 ? 5 : 0)) ? 'bg-blue-500 shadow-sm shadow-blue-200' : 'bg-slate-100'}`}></div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {isCustomizing && <FaceCustomizer onSave={handleAvatarSave} onCancel={() => setIsCustomizing(false)} />}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes pulse-slow {
          0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-4px) scale(1.01); opacity: 0.95; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
