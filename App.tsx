
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './components/Icons';
import { DEFAULT_AGENTS, DEMO_MESSAGES_INIT, DEMO_SESSION_ID } from './constants';
import { Agent, Message, Session, Role } from './types';
import { generateAgentResponse, generateSummary, playAgentAudio } from './services/geminiService';
import { LiveSessionManager } from './services/geminiLiveService';

// --- Helper Components ---

const Sidebar = ({ 
  sessions, 
  activeSessionId, 
  onNewSession, 
  onSelectSession,
  isOpen,
  onClose
}: { 
  sessions: Session[], 
  activeSessionId: string, 
  onNewSession: () => void, 
  onSelectSession: (id: string) => void,
  isOpen: boolean,
  onClose: () => void
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed md:relative z-50 h-full w-[280px] md:w-64 
        bg-secondary/95 md:bg-secondary/30 backdrop-blur-xl md:backdrop-blur-none
        border-r border-border flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between gap-2 font-bold text-xl text-primary">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded-lg">
              <Icons.Zap size={20} />
            </div>
            Nexus AI
          </div>
          <button onClick={onClose} className="md:hidden p-1 text-muted-foreground">
            <Icons.X size={24} />
          </button>
        </div>
        
        <div className="px-4 py-2">
          <button 
            onClick={() => { onNewSession(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl hover:bg-primary/90 transition-colors font-medium text-sm shadow-md"
          >
            <Icons.Plus size={16} />
            Nouveau Projet
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          <div className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Projets Récents</div>
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { onSelectSession(s.id); onClose(); }}
              className={`w-full text-left px-4 py-3 text-sm truncate flex items-center gap-3 rounded-lg transition-all ${
                s.id === activeSessionId 
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-foreground font-medium' 
                  : 'text-muted-foreground hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icons.MessageSquare size={16} className={s.id === activeSessionId ? 'text-primary' : 'opacity-50'} />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-border bg-secondary/50 md:bg-transparent">
          <Link 
            to="/settings" 
            onClick={onClose}
            className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-background"
          >
            <Icons.Settings size={18} />
            Paramètres
          </Link>
        </div>
      </div>
    </>
  );
};

const ReplyPreview = ({ msg, agents }: { msg: Message, agents: Agent[] }) => {
  const isUser = msg.senderId === 'user';
  const sender = isUser ? 'Vous' : agents.find(a => a.id === msg.senderId)?.name || 'Agent';
  const color = isUser ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400';
  
  return (
    <div className="bg-black/5 dark:bg-white/10 border-l-4 border-primary/50 rounded-r-lg p-2 mb-1 max-w-full overflow-hidden cursor-pointer opacity-90 text-[11px] md:text-xs">
      <span className={`font-bold ${color} block mb-0.5`}>{sender}</span>
      <p className="truncate text-foreground/80">{msg.content}</p>
    </div>
  );
};

const SwipeableMessage: React.FC<{ 
  children: React.ReactNode; 
  onReply: () => void;
  disabled: boolean;
}> = ({ children, onReply, disabled }) => {
  const [offset, setOffset] = useState(0);
  const touchStart = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    touchStart.current = e.targetTouches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || disabled) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStart.current;

    // Only allow right swipe, max 120px
    if (diff > 0 && diff < 150) {
      setOffset(Math.pow(diff, 0.85)); // slightly smoother curve
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (offset > 60) {
      if (navigator.vibrate) navigator.vibrate(10);
      onReply();
    }
    setOffset(0);
  };

  // Mouse Events for Desktop Swipe Simulation
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    touchStart.current = e.clientX;
    isDragging.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
     if (!isDragging.current || disabled) return;
     const diff = e.clientX - touchStart.current;
     if (diff > 0 && diff < 150) {
       setOffset(Math.pow(diff, 0.85));
     }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (offset > 60) {
      onReply();
    }
    setOffset(0);
  }

  return (
    <div 
      className="relative touch-pan-y select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
       {/* Reply Icon Indicator */}
       <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 flex items-center justify-center transition-opacity duration-200 z-10"
          style={{ 
            opacity: Math.min(offset / 50, 1),
            transform: `translate(${Math.min(offset / 2, 20)}px, -50%)`
          }}
       >
          <div className="bg-background p-2 rounded-full shadow-md border border-border text-primary">
             <Icons.Send size={16} className="rotate-180" />
          </div>
       </div>

       <div 
         className="transition-transform duration-200 ease-out"
         style={{ transform: `translateX(${offset}px)` }}
       >
         {children}
       </div>
    </div>
  );
};

const AudioPlayerButton = ({ text, voiceName }: { text: string, voiceName: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    if (isPlaying) return; // Basic prevention, ideally stop audio
    setLoading(true);
    try {
      await playAgentAudio(text, voiceName);
    } catch (e) {
      console.error("Failed to play audio", e);
    } finally {
      setLoading(false);
      setIsPlaying(false);
    }
  };

  return (
    <button 
      onClick={handlePlay}
      disabled={loading || isPlaying}
      className={`ml-2 p-1.5 rounded-full transition-all flex items-center justify-center ${
        loading ? 'bg-gray-200 dark:bg-gray-700 animate-pulse' : 'hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-primary'
      }`}
      title="Écouter le message"
    >
      {loading ? (
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      )}
    </button>
  );
}

const ChatMessage: React.FC<{ 
  msg: Message, 
  agents: Agent[], 
  onReplyTrigger: (msg: Message) => void,
  replyToMessage?: Message | null
}> = ({ msg, agents, onReplyTrigger, replyToMessage }) => {
  const isUser = msg.senderId === 'user';
  const agent = agents.find(a => a.id === msg.senderId);
  
  return (
    <SwipeableMessage onReply={() => onReplyTrigger(msg)} disabled={msg.isTyping || false}>
      <div className={`flex w-full mb-2 md:mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300 group ${isUser ? 'justify-end' : 'justify-start'}`}>
        
        {/* Desktop Reply Action (Hover) */}
        {isUser && (
           <button onClick={() => onReplyTrigger(msg)} className="hidden md:flex opacity-0 group-hover:opacity-100 items-center justify-center w-8 h-8 rounded-full hover:bg-secondary text-muted-foreground mr-2 transition-opacity self-center">
             <Icons.Send size={14} className="rotate-180" />
           </button>
        )}

        {/* Avatar for Agents */}
        {!isUser && (
          <div className="flex-shrink-0 mr-2 flex flex-col items-center justify-end pb-1">
            <img 
              src={agent?.avatar} 
              alt={agent?.name} 
              className="w-8 h-8 rounded-full border border-border object-cover shadow-sm" 
            />
          </div>
        )}

        {/* Updated Width Constraint here: sm:max-w-[40ch] */}
        <div className={`flex flex-col max-w-[85%] sm:max-w-[40ch] ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Name Label for Group Chat feel */}
          {!isUser && (
            <div className="ml-1 mb-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground/80 whitespace-nowrap">{agent?.name}</span>
              <span className={`text-[9px] px-1.5 py-px rounded-full font-medium uppercase tracking-wide opacity-80 whitespace-nowrap ${agent?.color}`}>
                {agent?.role}
              </span>
            </div>
          )}

          {/* Message Bubble */}
          <div className={`px-3 py-2 text-[15px] leading-relaxed shadow-sm break-words relative min-w-[100px] w-full ${
            isUser 
              ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-foreground rounded-2xl rounded-tr-none' 
              : 'bg-white dark:bg-[#202c33] text-foreground rounded-2xl rounded-tl-none'
          }`}>
            
            {/* Reply Context Display */}
            {replyToMessage && (
               <div className={`mb-2 rounded-md overflow-hidden border-l-4 ${isUser ? 'bg-white/40 dark:bg-black/20 border-green-600' : 'bg-black/5 dark:bg-white/5 border-purple-500'}`}>
                 <div className="p-1.5 text-xs cursor-pointer" onClick={() => document.getElementById(`msg-${replyToMessage.id}`)?.scrollIntoView({behavior:'smooth'})}>
                    <span className="font-bold opacity-90 block mb-0.5">
                      {replyToMessage.senderId === 'user' ? 'Vous' : agents.find(a => a.id === replyToMessage.senderId)?.name}
                    </span>
                    <p className="truncate opacity-75">{replyToMessage.content}</p>
                 </div>
               </div>
            )}

            {msg.isTyping ? (
              <div className="flex gap-1 h-6 items-center px-1">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
            
            {/* Timestamp & Audio */}
            <div className={`text-[10px] mt-1 text-right flex justify-end items-center gap-1 opacity-60`}>
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              {!isUser && !msg.isTyping && agent && (
                 <AudioPlayerButton text={msg.content} voiceName={agent.voiceName} />
              )}
              {isUser && !msg.isTyping && (
                 <span className="text-blue-500"><Icons.Send size={10} /></span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Reply Action (Hover) - Left side for Agent msgs */}
        {!isUser && (
           <button onClick={() => onReplyTrigger(msg)} className="hidden md:flex opacity-0 group-hover:opacity-100 items-center justify-center w-8 h-8 rounded-full hover:bg-secondary text-muted-foreground ml-2 transition-opacity self-center">
             <Icons.Send size={14} className="rotate-180" />
           </button>
        )}

      </div>
    </SwipeableMessage>
  );
};

const SummaryModal = ({ summary, onClose }: { summary: string, onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-border">
        <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30 rounded-t-2xl">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200 rounded-lg">
              <Icons.FileText size={20} />
            </div>
            Résumé Rapide
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <Icons.X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 prose prose-sm dark:prose-invert max-w-none">
           {summary.split('\n').map((line, i) => {
             if (line.startsWith('#')) return <h3 key={i} className="font-bold mt-4 mb-2">{line.replace(/#/g, '')}</h3>
             if (line.startsWith('-')) return <li key={i} className="ml-4 list-disc text-muted-foreground">{line.replace('-', '')}</li>
             return <p key={i} className="mb-2 text-foreground/90">{line}</p>
           })}
        </div>
        <div className="p-4 border-t border-border bg-muted/10 rounded-b-2xl flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

const VoiceModeModal = ({ onClose, agents }: { onClose: () => void, agents: Agent[] }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'speaking' | 'error'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const liveManagerRef = useRef<LiveSessionManager | null>(null);

  useEffect(() => {
    liveManagerRef.current = new LiveSessionManager((s: any) => setStatus(s));
    liveManagerRef.current.connect();
    return () => {
       liveManagerRef.current?.disconnect();
    }
  }, []);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  }

  return (
    <div className="fixed inset-0 bg-[#0f172a] text-white z-[100] flex flex-col items-center justify-between py-12 px-6 animate-in slide-in-from-bottom duration-300">
      
      {/* Top Bar */}
      <div className="w-full flex justify-between items-center opacity-80">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Nexus Live (Beta)</span>
          <span className="text-sm font-medium text-green-400 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`}></span>
            {status === 'connected' ? 'En ligne' : status}
          </span>
        </div>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <Icons.X size={20} />
        </button>
      </div>

      {/* Main Visual Area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-12">
        
        {/* Active Speakers (Simulated) */}
        <div className="flex justify-center items-center gap-4 flex-wrap max-w-md">
          {agents.map((agent, i) => (
            <div key={agent.id} className="flex flex-col items-center gap-2 relative group">
               {/* Speaking Indicator Ring */}
               <div className={`absolute inset-0 rounded-full border-2 border-blue-500 scale-110 opacity-0 transition-opacity duration-300 ${status === 'connected' && i === 1 ? 'opacity-100 animate-ping' : ''}`} />
               
               <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-slate-700 relative z-10">
                 <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
               </div>
               <span className="text-xs font-medium text-slate-300">{agent.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        {/* Waveform Visualizer */}
        <div className="h-24 w-full flex items-center justify-center gap-1.5">
           {status === 'connected' ? (
             [...Array(12)].map((_, i) => (
               <div 
                  key={i} 
                  className="w-2 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full animate-pulse" 
                  style={{ 
                    height: `${Math.random() * 80 + 20}%`, 
                    animationDuration: `${0.4 + Math.random() * 0.5}s` 
                  }}
               ></div>
             ))
           ) : (
             <div className="text-slate-500 text-sm animate-pulse">Connexion sécurisée en cours...</div>
           )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-xs flex items-center justify-around">
         <button 
           onClick={toggleMute}
           className={`p-5 rounded-full transition-all ${isMuted ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
         >
           {isMuted ? <Icons.MicOff size={28} /> : <Icons.Mic size={28} />}
         </button>

         <button 
           onClick={onClose}
           className="p-5 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.4)] transform hover:scale-105 transition-all"
         >
           <Icons.Phone size={32} className="rotate-[135deg]" />
         </button>
      </div>
    </div>
  )
}

const ChatArea = ({ 
  session, 
  messages, 
  agents, 
  onSendMessage, 
  onGenerateSummary,
  isProcessing,
  onToggleSidebar,
  isDebating,
  onStopDebate
}: { 
  session: Session, 
  messages: Message[], 
  agents: Agent[], 
  onSendMessage: (txt: string, replyToId?: string) => void, 
  onGenerateSummary: () => void,
  isProcessing: boolean,
  onToggleSidebar: () => void,
  isDebating: boolean,
  onStopDebate: () => void
}) => {
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, replyingTo, isDebating]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input, replyingTo?.id);
    setInput('');
    setReplyingTo(null);
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none" 
             style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")'}}></div>

      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-background/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="md:hidden p-2 -ml-2 hover:bg-secondary rounded-full text-muted-foreground">
            <Icons.Menu size={24} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2 overflow-hidden">
              {agents.slice(0,3).map(a => (
                <img key={a.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background object-cover" src={a.avatar} alt={a.name}/>
              ))}
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="font-bold text-sm md:text-base text-foreground truncate max-w-[120px] md:max-w-xs">{session.title}</h1>
              <div className="flex items-center gap-1">
                {isDebating ? (
                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    DÉBAT EN COURS
                  </span>
                ) : (
                   <span className="text-[10px] md:text-xs text-muted-foreground">3 Experts En Ligne</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {isDebating ? (
            <button 
               onClick={onStopDebate}
               className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-md animate-pulse"
            >
               STOP
            </button>
          ) : (
            <button 
              onClick={() => setShowVoiceMode(true)}
              className="flex items-center justify-center w-10 h-10 md:w-auto md:px-4 md:py-2 gap-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-full transition-colors shadow-md hover:shadow-lg"
            >
              <Icons.Phone size={18} />
              <span className="hidden md:inline">Appel Vocal</span>
            </button>
          )}
          
          <button 
            onClick={onGenerateSummary}
            className="flex items-center justify-center w-10 h-10 md:w-auto md:px-3 md:py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full md:rounded-lg transition-colors"
          >
            <Icons.FileText size={20} />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 relative z-0">
        {messages.filter(m => m.sessionId === session.id).map((msg) => (
          <div key={msg.id} id={`msg-${msg.id}`}>
             <ChatMessage 
                msg={msg} 
                agents={agents} 
                onReplyTrigger={handleReply}
                replyToMessage={msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null}
              />
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-4 bg-background border-t border-border z-20">
        <div className="max-w-4xl mx-auto">
          
          {/* Reply Preview Panel */}
          {replyingTo && (
             <div className="mb-2 bg-secondary/50 rounded-lg p-2 flex justify-between items-center border-l-4 border-primary animate-in slide-in-from-bottom-2">
                <div className="flex-1 overflow-hidden">
                   <span className="text-xs font-bold text-primary block">
                     Réponse à {replyingTo.senderId === 'user' ? 'Vous' : agents.find(a => a.id === replyingTo.senderId)?.name}
                   </span>
                   <p className="text-xs text-muted-foreground truncate">{replyingTo.content}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-background rounded-full">
                   <Icons.X size={16} />
                </button>
             </div>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            <div className="flex-1 bg-secondary/30 rounded-3xl border border-border flex items-center focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all focus-within:bg-background px-4 py-1">
               <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isDebating ? "Intervenir dans le débat..." : "Lancer une idée ou poser une question..."}
                className="w-full py-3 bg-transparent outline-none text-sm md:text-base disabled:opacity-50"
              />
            </div>
            <button 
              type="submit"
              disabled={!input.trim()}
              className={`p-3 rounded-full transition-all shadow-sm flex-shrink-0 flex items-center justify-center h-12 w-12 ${
                !input.trim() 
                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105'
              }`}
            >
              <Icons.Send size={20} className={input.trim() ? 'ml-0.5' : ''} />
            </button>
          </form>
        </div>
        {isProcessing && (
          <div className="text-center mt-2 text-[10px] text-muted-foreground animate-pulse uppercase tracking-widest font-medium">
            L'expert écrit...
          </div>
        )}
      </div>

      {showVoiceMode && <VoiceModeModal onClose={() => setShowVoiceMode(false)} agents={agents} />}
    </div>
  );
};

const SettingsPage = () => {
  const [key, setKey] = useState(process.env.API_KEY || '');
  
  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-secondary md:hidden">
          <Icons.X size={20} />
        </Link>
        <h1 className="text-2xl font-bold">Paramètres</h1>
      </div>
      
      <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-sm">
         <h2 className="font-semibold mb-4 flex items-center gap-2">
           <Icons.Zap size={18} className="text-primary" />
           Configuration API
         </h2>
         <div className="space-y-4">
            <label className="block text-sm font-medium text-muted-foreground">Clé API Google Gemini</label>
            <input 
              type="password" 
              value={key}
              disabled
              className="w-full p-3 rounded-lg border border-border bg-muted text-muted-foreground text-sm" 
              placeholder="La clé API est gérée via les variables d'environnement"
            />
            <p className="text-xs text-muted-foreground">
              La clé API est automatiquement chargée depuis l'environnement sécurisé.
            </p>
         </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Apparence</h2>
        <div className="flex items-center justify-between py-3 border-b border-border/50">
           <span>Mode Sombre</span>
           <button onClick={() => document.documentElement.classList.toggle('dark')} className="text-sm bg-secondary hover:bg-secondary/80 px-4 py-1.5 rounded-lg transition-colors font-medium">Basculer</button>
        </div>
      </div>
    </div>
  )
}

// --- Main Application ---

const App = () => {
  const [sessions, setSessions] = useState<Session[]>([
    { id: DEMO_SESSION_ID, title: 'Projet Smoothie', createdAt: Date.now(), updatedAt: Date.now(), agentIds: DEFAULT_AGENTS.map(a=>a.id), preview: 'Stratégie de lancement boisson protéinée' }
  ]);
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES_INIT);
  const [activeSessionId, setActiveSessionId] = useState<string>(DEMO_SESSION_ID);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSummary, setShowSummary] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Continuous Debate State
  const [isDebating, setIsDebating] = useState(false);
  const [debateEndTime, setDebateEndTime] = useState<number>(0);

  const currentSession = sessions.find(s => s.id === activeSessionId)!;

  // Continuous Debate Logic
  useEffect(() => {
    if (!isDebating) return;

    // Check if time is up
    if (Date.now() > debateEndTime) {
      setIsDebating(false);
      return;
    }

    // Safety: if processing, don't trigger another
    if (isProcessing) return;

    const lastMsg = messages[messages.length - 1];
    
    // Determine if we should trigger next agent
    // Trigger if: Last msg is from User OR Last msg is from Agent (keep chain going)
    // We add a delay to make it readable
    
    const timeoutId = setTimeout(async () => {
      // Determine who should speak next
      // 1. If last is user, pick Agent 1 (Business) usually, or random
      // 2. If last is Agent X, pick Agent Y (Round Robin or random)
      
      let nextAgent: Agent;
      
      if (lastMsg.senderId === 'user') {
         nextAgent = DEFAULT_AGENTS[0]; // Start with Business
      } else {
         // Find current index
         const currentIndex = DEFAULT_AGENTS.findIndex(a => a.id === lastMsg.senderId);
         // Next one
         const nextIndex = (currentIndex + 1) % DEFAULT_AGENTS.length;
         nextAgent = DEFAULT_AGENTS[nextIndex];
      }

      // Double check state before running
      if (!isDebating) return;

      await runAgentTurn(nextAgent, messages.filter(m => m.sessionId === activeSessionId), lastMsg.id);

    }, 2000 + Math.random() * 1000); // Wait 2-3 seconds before replying

    return () => clearTimeout(timeoutId);

  }, [messages, isDebating, isProcessing, debateEndTime, activeSessionId]);


  const handleSendMessage = async (text: string, replyToId?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      sessionId: activeSessionId,
      senderId: 'user',
      role: Role.USER,
      content: text,
      timestamp: Date.now(),
      replyToId: replyToId
    };

    setMessages(prev => [...prev, newMessage]);
    
    // If we are NOT debating, start a new debate session
    if (!isDebating) {
       setDebateEndTime(Date.now() + 3 * 60 * 1000); // 3 Minutes
       setIsDebating(true);
    } else {
       // If we ARE debating, the useEffect will pick up this new user message 
       // and the next agent will respond to it naturally.
    }
  };

  // A helper to run the agents in sequence with "typing" effect
  const runAgentTurn = async (agent: Agent, baseHistory: Message[], replyToId: string) => {
     setIsProcessing(true);
     
     // Create placeholder for typing
     const typingId = `typing-${Date.now()}`;
     setMessages(prev => [...prev, {
       id: typingId,
       sessionId: activeSessionId,
       senderId: agent.id,
       role: Role.AGENT,
       content: '...',
       timestamp: Date.now(),
       isTyping: true
     }]);

     const context = currentSession.preview; 
     const responseText = await generateAgentResponse(agent, baseHistory, context, DEFAULT_AGENTS);

     // Remove typing, add real message
     const newMsg: Message = {
         id: Date.now().toString(),
         sessionId: activeSessionId,
         senderId: agent.id,
         role: Role.AGENT,
         content: responseText,
         timestamp: Date.now(),
         replyToId: replyToId // Agent replies to specific message
     };

     setMessages(prev => {
       const filtered = prev.filter(m => m.id !== typingId);
       return [...filtered, newMsg];
     });
     
     setIsProcessing(false);
     return newMsg;
  };
  
  const handleNewSession = () => {
    const newId = Date.now().toString();
    const newSession: Session = {
      id: newId,
      title: 'Nouveau Brainstorm',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentIds: DEFAULT_AGENTS.map(a => a.id),
      preview: 'Nouveau projet vide'
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages(prev => [...prev, {
       id: Date.now().toString(),
       sessionId: newId,
       senderId: DEFAULT_AGENTS[0].id,
       role: Role.AGENT,
       content: "Bonjour ! Je suis Marc. Quelle idée de business analysons-nous aujourd'hui ?",
       timestamp: Date.now()
    }]);
    setIsDebating(false);
  };

  const handleGenerateSummary = async () => {
    const history = messages.filter(m => m.sessionId === activeSessionId);
    const summary = await generateSummary(history, DEFAULT_AGENTS);
    setShowSummary(summary);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
      <Sidebar 
        sessions={sessions} 
        activeSessionId={activeSessionId} 
        onNewSession={handleNewSession}
        onSelectSession={setActiveSessionId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Routes>
          <Route path="/" element={
            <ChatArea 
              session={currentSession} 
              messages={messages} 
              agents={DEFAULT_AGENTS}
              onSendMessage={handleSendMessage}
              onGenerateSummary={handleGenerateSummary}
              isProcessing={isProcessing}
              onToggleSidebar={() => setSidebarOpen(true)}
              isDebating={isDebating}
              onStopDebate={() => setIsDebating(false)}
            />
          } />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {showSummary && <SummaryModal summary={showSummary} onClose={() => setShowSummary(null)} />}
    </div>
  );
};

export default () => (
  <HashRouter>
    <App />
  </HashRouter>
);
