/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Users, Sparkles, User, BrainCircuit, Wrench, Heart, Download, RefreshCcw, Settings, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  roomId: string;
  speaker: string;
  content: string;
  roundNumber: number;
  createdAt: number;
}

interface Room {
  id: string;
  niche: string;
  taskType: string;
  roster: string[];
  createdAt: number;
}

// Map role IDs to their display configs
const ROLE_UI: Record<string, { name: string, color: string, icon: any }> = {
  user: { name: 'You', color: 'bg-blue-500', icon: User },
  system: { name: 'System', color: 'bg-gray-500', icon: Sparkles },
  strategist: { name: 'The Strategist', color: 'bg-emerald-500', icon: BrainCircuit },
  skeptic: { name: 'The Skeptical CFO', color: 'bg-rose-500', icon: Users },
  creative: { name: 'The Creative', color: 'bg-purple-500', icon: Sparkles },
  executor: { name: 'The Executor', color: 'bg-amber-500', icon: BrainCircuit },
  technical_architect: { name: 'The Tech Architect', color: 'bg-indigo-500', icon: Wrench },
  user_advocate: { name: 'The User Advocate', color: 'bg-teal-500', icon: Heart }
};

const PRESET_SCENES = [
  { name: 'Startup Pitch', roles: ['strategist', 'skeptic', 'creative'], prompt: "Help me prepare my startup pitch." },
  { name: 'Architecture Review', roles: ['technical_architect', 'executor', 'skeptic'], prompt: "Let's review the system architecture for a real-time app." },
  { name: 'Product Launch', roles: ['strategist', 'creative', 'user_advocate'], prompt: "We need a launch strategy for our new consumer app." }
];

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [crossTalkLevel, setCrossTalkLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [streamingAgent, setStreamingAgent] = useState<{ roleId: string, displayName: string, text: string } | null>(null);
  
  // New settings for roles
  const [availableRoles, setAvailableRoles] = useState<Record<string, { display_name: string, model: string, system_prompt: string, temperature: number }>>({});
  const [customRoles, setCustomRoles] = useState<Record<string, { display_name: string, model: string, system_prompt: string, temperature: number }>>({});
  const [activeRoster, setActiveRoster] = useState<string[]>([]);
  const [isManagePanelOpen, setIsManagePanelOpen] = useState(false);
  const [newRole, setNewRole] = useState({ id: '', display_name: '', model: 'open-mixtral-8x22b', system_prompt: '', temperature: 0.7 });
  const [isGeneratingRoles, setIsGeneratingRoles] = useState(false);
  const [scenePrompt, setScenePrompt] = useState('');
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);
  const [isSkipStream, setIsSkipStream] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStreamingAgent(null);
    setIsAutopilot(false);
  };

  const handleExit = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStreamingAgent(null);
    setIsAutopilot(false);
    setMessages([]);
    setActiveRoster(Object.keys(availableRoles));
    setRoom(null);
    setScenePrompt('');
    await initRoom();
  };

  const handleGenerateRoles = async () => {
    if (!scenePrompt.trim() || isGeneratingRoles) return;
    setIsGeneratingRoles(true);
    try {
      const res = await fetch('/api/generate-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: scenePrompt })
      });
      const data = await res.json();
      if (data.roles && Array.isArray(data.roles)) {
        const newCustomRoles: any = {};
        const newRoster: string[] = [];
        data.roles.forEach((r: any) => {
          newCustomRoles[r.id] = {
            display_name: r.display_name,
            model: r.model || 'mistral-large-latest',
            system_prompt: r.system_prompt,
            temperature: r.temperature || 0.7
          };
          newRoster.push(r.id);
        });
        setCustomRoles(prev => ({ ...prev, ...newCustomRoles }));
        setActiveRoster(newRoster);
        setScenePrompt('');
        setIsManagePanelOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingRoles(false);
    }
  };

  const initRoom = async () => {
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      const data = await res.json();
      setRoomId(data.roomId);
    } catch (err) {
      console.error('Failed to create room', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      setAvailableRoles(data);
      setActiveRoster(Object.keys(data));
    } catch (err) {
      console.error('Failed to fetch roles', err);
    }
  };

  // Initialize room on mount
  useEffect(() => {
    initRoom();
    fetchRoles();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingAgent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  }, [input]);

  const handleSend = async (overrideInput?: string, isAutoRun = false) => {
    const userText = overrideInput || input;
    if (!userText.trim() || !roomId || isProcessing || activeRoster.length === 0) return;

    setInput('');
    setIsProcessing(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: userText, 
          crossTalkLevel, 
          roster: activeRoster.length > 0 ? activeRoster : undefined,
          customRoles,
          fastMode: isFastMode,
          isAutopilot: isAutoRun,
          skipStream: isSkipStream
        }),
        signal: controller.signal
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // keep the last partial event in the buffer

        for (const part of parts) {
          const lines = part.split('\n');
          let event = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              event = line.slice(7);
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6);
            }
          }

          if (dataStr) {
            const data = JSON.parse(dataStr);
            if (event === 'room_update') {
              setRoom(data);
            } else if (event === 'message' || event === 'agent_done') {
              if (event === 'agent_done') {
                setStreamingAgent(null);
              }
              setMessages(prev => {
                // Ensure no duplicate IDs
                if (prev.find(m => m.id === data.id)) return prev;
                return [...prev, data];
              });
            } else if (event === 'agent_start') {
              setStreamingAgent({ roleId: data.roleId, displayName: data.displayName, text: '' });
            } else if (event === 'agent_chunk') {
              setStreamingAgent(prev => {
                if (!prev) return null;
                return { ...prev, text: prev.text + data.text };
              });
            } else if (event === 'done') {
              setIsProcessing(false);
            } else if (event === 'error') {
              console.error('Server error:', data.message);
              setIsProcessing(false);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        console.error('Chat error', err);
        setIsProcessing(false);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (isAutopilot && !isProcessing && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.speaker !== 'user' && lastMsg.speaker !== 'system') {
        const timer = setTimeout(() => {
          if (isAutopilot && !isProcessing) {
            handleSend("Please continue the discussion, building on the previous points.", true);
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isAutopilot, isProcessing, messages]);

  const startNewRoom = async () => {
    if (isProcessing) return;
    setMessages([]);
    setRoom(null);
    setStreamingAgent(null);
    await initRoom();
  };

  const getRoleUI = (speaker: string) => {
    if (ROLE_UI[speaker]) return ROLE_UI[speaker];
    if (customRoles[speaker]) return { name: customRoles[speaker].display_name, color: 'bg-indigo-600', icon: User };
    if (availableRoles[speaker]) return { name: availableRoles[speaker].display_name, color: 'bg-gray-400', icon: BrainCircuit };
    return { name: speaker, color: 'bg-gray-400', icon: User };
  };

  const exportTranscript = () => {
    if (!messages.length) return;
    const content = messages.map(m => {
      const roleName = m.speaker === 'user' ? 'You' : m.speaker === 'system' ? 'System' : getRoleUI(m.speaker).name;
      return `### ${roleName}\n${m.content}\n`;
    }).join('\n');
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ideation-transcript-${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderMessage = (msg: Message | { id: string, roomId: string, speaker: string, content: string }, isStreaming = false) => {
    const roleConfig = getRoleUI(msg.speaker);
    const Icon = roleConfig.icon;
    const isUser = msg.speaker === 'user';
    const isSystem = msg.speaker === 'system';

    return (
      <motion.div 
        key={msg.id}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}
      >
        <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
          
          <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white ${roleConfig.color} shadow-sm mt-1 ring-4 ring-white`}>
            <Icon size={18} className="md:w-5 md:h-5" />
          </div>
          
          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-gray-400 font-semibold mb-1.5 px-1 flex items-center gap-2 uppercase tracking-wide">
              {roleConfig.name}
              {isStreaming && (
                <motion.span 
                  animate={{ opacity: [0.3, 1, 0.3] }} 
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full" 
                />
              )}
            </span>
            <div 
              className={`px-5 py-4 rounded-3xl ${
                isUser 
                  ? 'bg-blue-600 text-white rounded-tr-sm shadow-md' 
                  : isSystem
                    ? 'bg-gray-50 text-gray-500 italic rounded-tl-sm border border-gray-100'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm prose prose-sm prose-slate max-w-none'
              }`}
            >
              <div className="text-[15px] leading-relaxed break-words">
                {isUser ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <Markdown>{msg.content}</Markdown>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Users size={24} />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight">Ideation Room</h1>
            <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              {activeRoster.length ? `${activeRoster.length} agents ready` : 'No agents selected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="crossTalk" className="text-sm text-gray-500 font-medium hidden sm:inline-block">Cross-talk:</label>
            <select
              id="crossTalk"
              value={crossTalkLevel}
              onChange={(e) => setCrossTalkLevel(e.target.value as 'low' | 'medium' | 'high')}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              disabled={isProcessing}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3 border-l border-gray-200 pl-3 sm:pl-4 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 font-medium cursor-pointer select-none" title="Let agents brainstorm back and forth automatically">
              <input 
                type="checkbox" 
                checked={isAutopilot} 
                onChange={e => setIsAutopilot(e.target.checked)} 
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              Autopilot
            </label>
            <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 font-medium cursor-pointer select-none" title="Reduce agent-to-agent delay">
              <input 
                type="checkbox" 
                checked={isFastMode} 
                onChange={e => setIsFastMode(e.target.checked)} 
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              Fast Mode
            </label>
            <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 font-medium cursor-pointer select-none" title="Skip typing stream and show full text instantly">
              <input 
                type="checkbox" 
                checked={isSkipStream} 
                onChange={e => setIsSkipStream(e.target.checked)} 
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              Instant Text
            </label>
          </div>

          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            <button
              onClick={() => setIsManagePanelOpen(true)}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Manage Panel"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={exportTranscript}
              disabled={messages.length === 0}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Export as Markdown"
            >
              <Download size={18} />
            </button>
            <button
              onClick={startNewRoom}
              disabled={isProcessing}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Start New Room"
            >
              <RefreshCcw size={18} />
            </button>
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-semibold transition-colors border border-rose-100 shadow-sm"
              title="Exit Brainstorm & Clear Session"
            >
              <X size={14} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Chat Log */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 space-y-2">
        <div className="max-w-4xl mx-auto">
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-12 w-full max-w-2xl mx-auto space-y-6">
              
              {/* Custom Scene Generator */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Sparkles size={24} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-gray-900">Auto-Generate Panel</h2>
                    <p className="text-sm text-gray-500">Describe a scenario and we'll assemble the perfect AI experts.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateRoles();
                    }}
                    placeholder="e.g. A debate on the ethics of AI..."
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    disabled={isGeneratingRoles}
                  />
                  <button
                    onClick={handleGenerateRoles}
                    disabled={!scenePrompt.trim() || isGeneratingRoles}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                  >
                    {isGeneratingRoles ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Generate Roles'
                    )}
                  </button>
                </div>
              </div>

              {/* Preset Scenes */}
              <div className="w-full">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Or jump into a preset scene</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PRESET_SCENES.map((scene, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setActiveRoster(scene.roles);
                        handleSend(scene.prompt);
                      }}
                      className="text-left bg-white hover:bg-gray-50 p-4 rounded-xl border border-gray-200 transition-colors group relative overflow-hidden flex flex-col"
                    >
                      <div className="font-medium text-gray-900 mb-1">{scene.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-2">{scene.prompt}</div>
                      <div className="mt-3 flex -space-x-2">
                        {scene.roles.map(r => {
                          const conf = availableRoles[r] || customRoles[r];
                          if (!conf) return null;
                          return (
                            <div key={r} title={conf.display_name} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600">
                              {conf.display_name.charAt(0)}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skip to Text Box Option */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 text-sm">Skip to Text Brainstorming</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Skip role configuration and start discussing with default agents instantly.</p>
                </div>
                <button
                  onClick={() => {
                    const defaultRoles = Object.keys(availableRoles).length > 0 
                      ? Object.keys(availableRoles) 
                      : ['strategist', 'skeptic', 'creative', 'executor', 'technical_architect', 'user_advocate'];
                    setActiveRoster(defaultRoles);
                    setTimeout(() => {
                      textareaRef.current?.focus();
                    }, 50);
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-4 py-2.5 rounded-xl font-semibold transition-colors border border-indigo-100"
                >
                  Skip and start typing
                </button>
              </div>

            </div>
          )}

          <AnimatePresence>
            {messages.map(m => renderMessage(m))}
            
            {/* Streaming Agent Indicator */}
            {streamingAgent && renderMessage({
              id: 'streaming',
              roomId: roomId!,
              speaker: streamingAgent.roleId,
              content: streamingAgent.text
            }, true)}
          </AnimatePresence>
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={activeRoster.length > 0 ? "Describe your idea or ask the panel a question..." : "Please select at least one agent to brainstorm..."}
            className={`w-full bg-gray-50 border border-gray-200 rounded-2xl pl-5 pr-14 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner resize-none min-h-[56px] max-h-32 ${activeRoster.length === 0 ? 'opacity-50 bg-gray-100 cursor-not-allowed' : ''}`}
            rows={1}
            disabled={isProcessing || !roomId || activeRoster.length === 0}
          />
          {isProcessing ? (
            <button
              onClick={handleCancel}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-xl transition-colors shadow-sm animate-pulse"
              title="Cancel generation"
            >
              <X size={18} />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !roomId || activeRoster.length === 0}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
            >
              <Send size={18} />
            </button>
          )}
        </div>
        <div className="text-center mt-2 flex flex-wrap items-center justify-center gap-3">
           {isProcessing && (
             <button
               onClick={handleCancel}
               className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-full text-[11px] font-semibold transition-colors border border-rose-100 shadow-sm animate-pulse"
               title="Cancel active brainstorming generation"
             >
               <span className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-ping inline-block"></span>
               <span>Cancel Stream</span>
             </button>
           )}
           <span className="text-[11px] text-gray-400 font-medium">Shift + Enter for new line</span>
        </div>
      </div>
      
      {/* Manage Panel Modal */}
      <AnimatePresence>
        {isManagePanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold">Manage AI Panel</h2>
                <button onClick={() => setIsManagePanelOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-5 flex-1 flex flex-col gap-8">
                {/* Active Roster */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users size={16} className="text-blue-600" /> Predefined Agents
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(availableRoles).map(([id, role]) => (
                      <label key={id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activeRoster.includes(id) ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                        <input 
                          type="checkbox" 
                          className="mt-1"
                          checked={activeRoster.includes(id)}
                          onChange={(e) => {
                            if (e.target.checked) setActiveRoster(prev => [...prev, id]);
                            else setActiveRoster(prev => prev.filter(r => r !== id));
                          }}
                        />
                        <div>
                          <div className="font-medium text-sm text-gray-900">{role.display_name}</div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{role.system_prompt}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom Roles */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Wrench size={16} className="text-indigo-600" /> Custom Agents
                  </h3>
                  
                  {Object.keys(customRoles).length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {Object.entries(customRoles).map(([id, role]) => (
                        <label key={id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activeRoster.includes(id) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                          <input 
                            type="checkbox" 
                            className="mt-1"
                            checked={activeRoster.includes(id)}
                            onChange={(e) => {
                              if (e.target.checked) setActiveRoster(prev => [...prev, id]);
                              else setActiveRoster(prev => prev.filter(r => r !== id));
                            }}
                          />
                          <div>
                            <div className="font-medium text-sm text-gray-900">{role.display_name}</div>
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{role.system_prompt}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Create New Agent</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">ID (no spaces)</label>
                          <input 
                            type="text" 
                            value={newRole.id}
                            onChange={e => setNewRole({...newRole, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                            placeholder="e.g. devil_advocate"
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
                          <input 
                            type="text" 
                            value={newRole.display_name}
                            onChange={e => setNewRole({...newRole, display_name: e.target.value})}
                            placeholder="e.g. Devil's Advocate"
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">System Prompt</label>
                        <textarea 
                          value={newRole.system_prompt}
                          onChange={e => setNewRole({...newRole, system_prompt: e.target.value})}
                          placeholder="You are a..."
                          className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 min-h-[80px]"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button 
                          onClick={() => {
                            if (!newRole.id || !newRole.display_name || !newRole.system_prompt) return;
                            setCustomRoles(prev => ({ ...prev, [newRole.id]: {
                              display_name: newRole.display_name,
                              model: newRole.model,
                              system_prompt: newRole.system_prompt,
                              temperature: newRole.temperature
                            }}));
                            setActiveRoster(prev => [...prev, newRole.id]);
                            setNewRole({ id: '', display_name: '', model: 'open-mixtral-8x22b', system_prompt: '', temperature: 0.7 });
                          }}
                          disabled={!newRole.id || !newRole.display_name || !newRole.system_prompt}
                          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          <Plus size={16} /> Add Agent
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button 
                  onClick={() => setIsManagePanelOpen(false)}
                  className="bg-gray-900 text-white px-5 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
