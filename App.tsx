
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, Volume2, Languages, RefreshCcw, Info, Trophy, BookOpen, Calendar, AlertCircle } from 'lucide-react';
import { decode, decodeAudioData, createPcmBlob } from './utils/audioUtils';
import { SessionStatus, TranscriptItem, UserProgress } from './types';

const PROGRESS_KEY = 'salut_french_progress_v1';
const MAX_RETRIES = 2;

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {
      sessionsCompleted: 0,
      currentLevel: 'Iniciante',
      lastLessonDate: null,
      masteredTopics: []
    };
  });
  
  // Refs for audio and session management
  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const retryCountRef = useRef(0);

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // Persist progress when it changes
  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close?.();
      } catch (e) {
        console.warn('Error closing session:', e);
      }
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
      audioContextInRef.current.close().catch(console.error);
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close().catch(console.error);
      audioContextOutRef.current = null;
    }
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    // Update progress on session end if it was a successful session
    if (status === SessionStatus.CONNECTED) {
      setProgress(prev => {
        const newCount = prev.sessionsCompleted + 1;
        let newLevel = prev.currentLevel;
        if (newCount > 20) newLevel = 'Avançado';
        else if (newCount > 5) newLevel = 'Intermediário';
        
        return {
          ...prev,
          sessionsCompleted: newCount,
          currentLevel: newLevel,
          lastLessonDate: new Date().toLocaleDateString('pt-BR')
        };
      });
    }

    setStatus(SessionStatus.IDLE);
  }, [status]);

  const startSession = async (retry: boolean = false) => {
    if (!retry) {
      retryCountRef.current = 0;
    }

    try {
      setStatus(SessionStatus.CONNECTING);
      setError(null);

      // Initialization of Google GenAI client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      // Setup Audio Contexts
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      if (audioContextOutRef.current.state === 'suspended') {
        await audioContextOutRef.current.resume();
      }

      // Get Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `Você é um professor de francês dedicado e carismático. 

PERFIL DO ALUNO:
- Nível Atual: ${progress.currentLevel}
- Sessões Completadas: ${progress.sessionsCompleted}
- Última aula: ${progress.lastLessonDate || 'Esta é a primeira aula!'}

OBJETIVO DA SESSÃO: 
Você DEVE iniciar a aula se apresentando IMEDIATAMENTE (ex: "Bonjour! Sou seu tutor de francês. Como esta é nossa aula número ${progress.sessionsCompleted + 1}, vamos focar em conversação prática!").
Mantenha a conversa dinâmica.

FLUXO DA AULA:
1. Comece com uma saudação e uma frase curta em francês.
2. Traduza para o português.
3. Peça para o aluno repetir a frase em francês.
4. Escute o aluno e avalie a pronúncia com carinho, dando dicas técnicas de fonética.
5. Avance para temas mais complexos se o aluno estiver indo bem.

Sempre use português para dar instruções e feedback, e francês para o conteúdo de ensino.`,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(SessionStatus.CONNECTED);
            retryCountRef.current = 0; // Reset retries on success
            
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                if (session) session.sendRealtimeInput({ media: pcmBlob });
              }).catch(() => {});
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message) => {
            const audioParts = message.serverContent?.modelTurn?.parts?.filter(p => p.inlineData);
            if (audioParts && audioParts.length > 0 && audioContextOutRef.current) {
              const ctx = audioContextOutRef.current;
              for (const part of audioParts) {
                const base64Audio = part.inlineData?.data;
                if (!base64Audio) continue;
                if (ctx.state === 'suspended') await ctx.resume();
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
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
          onerror: (e) => {
            console.error('Session Error:', e);
            if (retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              console.log(`Retrying connection... (${retryCountRef.current}/${MAX_RETRIES})`);
              setTimeout(() => startSession(true), 1500 * retryCountRef.current);
            } else {
              setError('O serviço está temporariamente indisponível. Por favor, tente novamente em alguns instantes.');
              stopSession();
            }
          },
          onclose: () => {
            if (status !== SessionStatus.CONNECTING) stopSession();
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Failed to start session:', err);
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setTimeout(() => startSession(true), 2000);
      } else {
        setError('Não foi possível conectar ao professor. Verifique sua internet ou tente mais tarde.');
        setStatus(SessionStatus.ERROR);
      }
    }
  };

  const resetProgress = () => {
    if (confirm('Deseja realmente reiniciar todo o seu progresso?')) {
      setProgress({
        sessionsCompleted: 0,
        currentLevel: 'Iniciante',
        lastLessonDate: null,
        masteredTopics: []
      });
      setTranscripts([]);
      localStorage.removeItem(PROGRESS_KEY);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100">
            <Languages size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Salut! <span className="text-blue-600">Pro</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
            <Trophy size={14} />
            Lvl: {progress.currentLevel}
          </div>
          {status === SessionStatus.CONNECTED && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold animate-pulse">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              AO VIVO
            </div>
          )}
          <button onClick={resetProgress} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Resetar Progresso">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6 overflow-hidden">
        
        {status === SessionStatus.IDLE && transcripts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-2xl mx-auto w-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-1">
                <div className="bg-orange-100 w-10 h-10 rounded-xl flex items-center justify-center text-orange-600 mb-2">
                  <BookOpen size={20} />
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aulas Totais</div>
                <div className="text-2xl font-black text-slate-800">{progress.sessionsCompleted}</div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-1">
                <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-2">
                  <Trophy size={20} />
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nível Atual</div>
                <div className="text-2xl font-black text-slate-800">{progress.currentLevel}</div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-1">
                <div className="bg-purple-100 w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 mb-2">
                  <Calendar size={20} />
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Última Prática</div>
                <div className="text-lg font-black text-slate-800">{progress.lastLessonDate || '--/--'}</div>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-4 pt-6">
              <div className="relative">
                <div className="absolute -inset-6 bg-blue-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                <div className="w-28 h-28 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center relative border border-slate-50">
                  <Headphones size={56} className="text-blue-600" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-800">Prêt para aprender?</h2>
              <p className="text-slate-500 max-w-sm leading-relaxed">
                Seu professor de francês está esperando. Vamos praticar sua pronúncia e conversação em tempo real.
              </p>
            </div>

            <button
              onClick={() => startSession()}
              className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-black py-6 px-10 rounded-[2rem] shadow-2xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3 text-xl"
            >
              <Mic size={24} />
              Iniciar Aula
            </button>
          </div>
        )}

        {(status !== SessionStatus.IDLE || transcripts.length > 0) && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-40 scrollbar-hide px-2">
            {transcripts.map((item) => (
              <div key={item.id} className={`flex flex-col max-w-[85%] ${item.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className={`px-5 py-3 rounded-2xl text-sm md:text-base ${
                  item.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100 font-medium' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm font-medium'
                }`}>
                  {item.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1.5 font-black uppercase tracking-widest px-1">
                  {item.role === 'user' ? 'Você' : 'Professor'}
                </span>
              </div>
            ))}
            {status === SessionStatus.CONNECTING && (
              <div className="flex flex-col items-center justify-center py-16 gap-5 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                </div>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Conectando com o professor...</p>
              </div>
            )}
            <div id="anchor"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 p-5 rounded-3xl flex items-start gap-4 text-red-600 mx-2 animate-in fade-in slide-in-from-bottom-2 shadow-sm">
            <AlertCircle className="mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-tight mb-1">Ops! Algo deu errado</p>
              <p className="text-sm font-medium opacity-80">{error}</p>
              <button 
                onClick={() => startSession()}
                className="mt-3 text-xs font-black bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition-colors uppercase tracking-widest"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-slate-100 p-6 pb-10 md:pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
          <div className="hidden md:flex items-center gap-3">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${status === SessionStatus.CONNECTED ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-300'}`}>
               <Volume2 size={24} />
             </div>
             <div>
               <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Microfone</div>
               <div className="text-sm font-bold text-slate-600">
                 {status === SessionStatus.CONNECTED ? 'Ouvindo...' : 'Inativo'}
               </div>
             </div>
          </div>

          <div className="flex-1 md:flex-none flex justify-center relative">
            {status === SessionStatus.IDLE ? (
              <button
                onClick={() => startSession()}
                className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-full shadow-2xl shadow-blue-200 transition-all active:scale-90"
              >
                <Mic size={32} />
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <button
                  onClick={stopSession}
                  className="bg-red-500 hover:bg-red-600 text-white p-6 rounded-full shadow-2xl shadow-red-100 transition-all active:scale-90 relative z-10"
                >
                  <MicOff size={32} />
                </button>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-red-100 rounded-full animate-ping opacity-10"></div>
                <span className="text-[10px] font-black text-red-500 mt-3 tracking-widest uppercase">Encerrar</span>
              </div>
            )}
          </div>

          <div className="hidden sm:flex flex-col items-end">
             <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Progresso</div>
             <div className="flex gap-1.5">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`w-5 h-1.5 rounded-full transition-all duration-500 ${i <= (progress.sessionsCompleted % 5 || (progress.sessionsCompleted > 0 ? 5 : 0)) ? 'bg-blue-500' : 'bg-slate-100'}`}></div>
                ))}
             </div>
          </div>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default App;
