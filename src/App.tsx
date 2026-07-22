/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Send, Users, Sparkles, User, BrainCircuit, Wrench, Heart, Download, 
  RefreshCcw, Settings, Plus, X, Check, Trash2, MessageSquare, Zap, Sliders, Shield, Compass, Lightbulb, PlusCircle 
} from 'lucide-react';
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

interface CharacterConfig {
  display_name: string;
  model: string;
  system_prompt: string;
  temperature: number;
  color?: string;
  iconType?: string;
}

// Built-in role UI configurations
const ROLE_UI: Record<string, { name: string, color: string, icon: any }> = {
  user: { name: 'You', color: 'bg-blue-600', icon: User },
  system: { name: 'System', color: 'bg-neutral-500', icon: Sparkles },
  strategist: { name: 'The Strategist', color: 'bg-emerald-600', icon: BrainCircuit },
  skeptic: { name: 'The Skeptical CFO', color: 'bg-rose-600', icon: Shield },
  creative: { name: 'The Creative', color: 'bg-purple-600', icon: Lightbulb },
  executor: { name: 'The Executor', color: 'bg-amber-600', icon: Compass },
  technical_architect: { name: 'The Tech Architect', color: 'bg-indigo-600', icon: Wrench },
  user_advocate: { name: 'The User Advocate', color: 'bg-teal-600', icon: Heart }
};

const COLOR_OPTIONS = [
  { name: 'Indigo', value: 'bg-indigo-600', border: 'border-indigo-200', bgLight: 'bg-indigo-50/50' },
  { name: 'Emerald', value: 'bg-emerald-600', border: 'border-emerald-200', bgLight: 'bg-emerald-50/50' },
  { name: 'Purple', value: 'bg-purple-600', border: 'border-purple-200', bgLight: 'bg-purple-50/50' },
  { name: 'Rose', value: 'bg-rose-600', border: 'border-rose-200', bgLight: 'bg-rose-50/50' },
  { name: 'Amber', value: 'bg-amber-600', border: 'border-amber-200', bgLight: 'bg-amber-50/50' },
  { name: 'Cyan', value: 'bg-cyan-600', border: 'border-cyan-200', bgLight: 'bg-cyan-50/50' },
  { name: 'Teal', value: 'bg-teal-600', border: 'border-teal-200', bgLight: 'bg-teal-50/50' },
  { name: 'Violet', value: 'bg-violet-600', border: 'border-violet-200', bgLight: 'bg-violet-50/50' }
];

const PRESET_SCENES = [
  { name: 'Startup Pitch', roles: ['strategist', 'skeptic', 'creative'], prompt: "Help me refine my startup pitch and challenge my assumptions." },
  { name: 'Architecture Review', roles: ['technical_architect', 'executor', 'skeptic'], prompt: "Let's review the technical design and scalability of a real-time web platform." },
  { name: 'Product Launch', roles: ['strategist', 'creative', 'user_advocate'], prompt: "We need an integrated launch strategy and user onboarding plan for our new application." }
];

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [crossTalkLevel, setCrossTalkLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [streamingAgent, setStreamingAgent] = useState<{ roleId: string, displayName: string, text: string } | null>(null);
  
  // Available & Custom Roles
  const [availableRoles, setAvailableRoles] = useState<Record<string, CharacterConfig>>({});
  const [customRoles, setCustomRoles] = useState<Record<string, CharacterConfig>>(() => {
    try {
      const saved = localStorage.getItem('brainstorm_custom_roles');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const [activeRoster, setActiveRoster] = useState<string[]>([]);
  const [isManagePanelOpen, setIsManagePanelOpen] = useState(false);
  const [isCreateCharacterModalOpen, setIsCreateCharacterModalOpen] = useState(false);
  
  // Custom Role Form State
  const [newCharacter, setNewCharacter] = useState({
    display_name: '',
    system_prompt: '',
    color: 'bg-indigo-600',
    model: 'mistral-large-latest',
    temperature: 0.7
  });

  const [isGeneratingRoles, setIsGeneratingRoles] = useState(false);
  const [scenePrompt, setScenePrompt] = useState('');
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);
  const [isSkipStream, setIsSkipStream] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync custom roles to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('brainstorm_custom_roles', JSON.stringify(customRoles));
    } catch (err) {
      console.error('Failed to persist custom roles', err);
    }
  }, [customRoles]);

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
        const newCustomRoles: Record<string, CharacterConfig> = {};
        const newRoster: string[] = [];
        data.roles.forEach((r: any) => {
          const charId = r.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          newCustomRoles[charId] = {
            display_name: r.display_name,
            model: r.model || 'mistral-large-latest',
            system_prompt: r.system_prompt,
            temperature: r.temperature || 0.7,
            color: COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].value
          };
          newRoster.push(charId);
        });
        setCustomRoles(prev => ({ ...prev, ...newCustomRoles }));
        setActiveRoster(prev => Array.from(new Set([...prev, ...newRoster])));
        setScenePrompt('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingRoles(false);
    }
  };

  const handleCreateCustomCharacter = () => {
    if (!newCharacter.display_name.trim() || !newCharacter.system_prompt.trim()) return;

    const charId = `custom_${Date.now()}_${newCharacter.display_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const createdConfig: CharacterConfig = {
      display_name: newCharacter.display_name.trim(),
      system_prompt: newCharacter.system_prompt.trim(),
      color: newCharacter.color,
      model: newCharacter.model,
      temperature: newCharacter.temperature
    };

    setCustomRoles(prev => ({ ...prev, [charId]: createdConfig }));
    setActiveRoster(prev => [...prev, charId]);
    setNewCharacter({
      display_name: '',
      system_prompt: '',
      color: 'bg-indigo-600',
      model: 'mistral-large-latest',
      temperature: 0.7
    });
    setIsCreateCharacterModalOpen(false);
  };

  const handleDeleteCustomCharacter = (charId: string) => {
    setCustomRoles(prev => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setActiveRoster(prev => prev.filter(id => id !== charId));
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
      if (activeRoster.length === 0) {
        setActiveRoster(Object.keys(data));
      }
    } catch (err) {
      console.error('Failed to fetch roles', err);
    }
  };

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
        
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

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
    if (customRoles[speaker]) {
      return { 
        name: customRoles[speaker].display_name, 
        color: customRoles[speaker].color || 'bg-indigo-600', 
        icon: User 
      };
    }
    if (availableRoles[speaker]) {
      return { 
        name: availableRoles[speaker].display_name, 
        color: 'bg-neutral-600', 
        icon: BrainCircuit 
      };
    }
    return { name: speaker, color: 'bg-neutral-600', icon: User };
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
    a.download = `brainstorm-transcript-${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleRoleSelection = (roleId: string) => {
    setActiveRoster(prev => 
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const allRoleKeys = [...Object.keys(availableRoles), ...Object.keys(customRoles)];

  const renderMessage = (msg: Message | { id: string, roomId: string, speaker: string, content: string }, isStreaming = false) => {
    const roleConfig = getRoleUI(msg.speaker);
    const Icon = roleConfig.icon;
    const isUser = msg.speaker === 'user';
    const isSystem = msg.speaker === 'system';

    return (
      <motion.div 
        key={msg.id}
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-5 group`}
      >
        <div className={`flex max-w-[88%] sm:max-w-[82%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
          
          <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white ${roleConfig.color} shadow-sm mt-0.5`}>
            <Icon size={18} />
          </div>
          
          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                {roleConfig.name}
              </span>
              {isStreaming && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping" />
                  thinking...
                </span>
              )}
            </div>
            
            <div 
              className={`px-5 py-3.5 rounded-2xl text-[14.5px] leading-relaxed transition-all ${
                isUser 
                  ? 'bg-neutral-900 text-white rounded-tr-xs shadow-sm' 
                  : isSystem
                    ? 'bg-neutral-100 text-neutral-600 italic rounded-tl-xs border border-neutral-200/80'
                    : 'bg-white text-neutral-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-200/80 rounded-tl-xs prose prose-slate max-w-none'
              }`}
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <Markdown>{msg.content}</Markdown>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#FAF9FB] text-neutral-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Sleek Minimalist Glass Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-neutral-200/80 py-3.5 px-4 sm:px-6 flex items-center justify-between z-20 sticky top-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 p-2 rounded-xl text-white shadow-xs">
            <BrainCircuit size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-neutral-900 tracking-tight">Brainstorm Studio</h1>
              <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200/60">
                AI Panel
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${activeRoster.length ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {activeRoster.length ? `${activeRoster.length} characters active` : 'No characters selected'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex items-center gap-2">
            <label htmlFor="crossTalk" className="text-xs text-neutral-500 font-medium">Cross-talk:</label>
            <select
              id="crossTalk"
              value={crossTalkLevel}
              onChange={(e) => setCrossTalkLevel(e.target.value as 'low' | 'medium' | 'high')}
              className="text-xs bg-neutral-100 hover:bg-neutral-200/60 border border-neutral-200/80 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-neutral-800 font-medium transition-colors"
              disabled={isProcessing}
            >
              <option value="low">Low Dynamics</option>
              <option value="medium">Medium Dynamics</option>
              <option value="high">High Dynamics</option>
            </select>
          </div>

          <div className="hidden lg:flex items-center gap-3 border-l border-neutral-200/80 pl-4">
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium cursor-pointer select-none" title="Let agents converse back and forth automatically">
              <input 
                type="checkbox" 
                checked={isAutopilot} 
                onChange={e => setIsAutopilot(e.target.checked)} 
                className="w-3.5 h-3.5 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-800"
              />
              Autopilot
            </label>
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium cursor-pointer select-none" title="Faster inter-agent responses">
              <input 
                type="checkbox" 
                checked={isFastMode} 
                onChange={e => setIsFastMode(e.target.checked)} 
                className="w-3.5 h-3.5 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-800"
              />
              Fast Mode
            </label>
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium cursor-pointer select-none" title="Show text instantly without stream delay">
              <input 
                type="checkbox" 
                checked={isSkipStream} 
                onChange={e => setIsSkipStream(e.target.checked)} 
                className="w-3.5 h-3.5 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-800"
              />
              Instant Text
            </label>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-neutral-200/80 pl-2 sm:pl-4">
            <button
              onClick={() => setIsManagePanelOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 rounded-xl transition-colors border border-neutral-200/60"
              title="Manage Characters & Roster"
            >
              <Sliders size={14} />
              <span className="hidden sm:inline">Characters</span>
            </button>

            <button
              onClick={exportTranscript}
              disabled={messages.length === 0}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl disabled:opacity-30 transition-colors"
              title="Export Transcript"
            >
              <Download size={16} />
            </button>

            <button
              onClick={startNewRoom}
              disabled={isProcessing}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl disabled:opacity-30 transition-colors"
              title="New Room"
            >
              <RefreshCcw size={16} />
            </button>

            <button
              onClick={handleExit}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold transition-colors border border-rose-100"
              title="Clear Room & Reset"
            >
              <X size={14} />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sub-header Active Character Strip when actively conversing */}
      {messages.length > 0 && (
        <div className="bg-white/60 border-b border-neutral-200/60 px-4 py-2 flex items-center justify-between overflow-x-auto text-xs gap-3">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px] flex-shrink-0">Active Panel:</span>
            {activeRoster.map(id => {
              const conf = getRoleUI(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleRoleSelection(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${conf.color} text-white shadow-2xs`}
                >
                  <span className="truncate max-w-[110px]">{conf.name}</span>
                  <X size={12} className="hover:opacity-80" />
                </button>
              );
            })}
            <button
              onClick={() => setIsManagePanelOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 rounded-full border border-neutral-200/80 font-medium transition-colors text-xs flex-shrink-0"
            >
              <Plus size={12} /> Add Persona
            </button>
          </div>
        </div>
      )}

      {/* Chat Body & Initial Load Hub */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          
          {/* INITIAL LOAD: CHARACTER SELECTION & CREATION HUB */}
          {messages.length === 0 && (
            <div className="space-y-8 my-4">
              
              {/* Hero Banner */}
              <div className="text-center max-w-xl mx-auto space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                  <Sparkles size={14} /> Collaborative AI Brainstorming
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                  Choose Your Specialist Characters
                </h2>
                <p className="text-sm text-neutral-500">
                  Select characters to join your brainstorming room, or build custom personas with unique perspectives.
                </p>
              </div>

              {/* Character Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    Available Characters
                  </h3>
                  <span className="px-2 py-0.5 bg-neutral-200/70 text-neutral-700 rounded-full text-xs font-semibold">
                    {activeRoster.length} / {allRoleKeys.length} Selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveRoster(allRoleKeys)}
                    className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-1.5 bg-white border border-neutral-200/80 hover:bg-neutral-50 rounded-xl transition-colors shadow-2xs"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setActiveRoster([])}
                    className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-1.5 bg-white border border-neutral-200/80 hover:bg-neutral-50 rounded-xl transition-colors shadow-2xs"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setIsCreateCharacterModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 px-3.5 py-1.5 rounded-xl transition-colors shadow-2xs"
                  >
                    <Plus size={14} /> Create Character
                  </button>
                </div>
              </div>

              {/* Character Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* Predefined Characters */}
                {Object.entries(availableRoles).map(([id, role]) => {
                  const isSelected = activeRoster.includes(id);
                  const ui = getRoleUI(id);
                  const Icon = ui.icon;

                  return (
                    <div
                      key={id}
                      onClick={() => toggleRoleSelection(id)}
                      className={`relative p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between group ${
                        isSelected 
                          ? 'bg-white border-neutral-900 ring-2 ring-neutral-900/10 shadow-sm' 
                          : 'bg-white/80 border-neutral-200/80 hover:border-neutral-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${ui.color} shadow-2xs`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-neutral-900 text-sm tracking-tight">{role.display_name}</h4>
                            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-md">
                              {role.model}
                            </span>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                          isSelected ? 'bg-neutral-900 text-white' : 'border border-neutral-300 group-hover:border-neutral-400'
                        }`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>

                      <p className="text-xs text-neutral-500 mt-3 line-clamp-2 leading-relaxed font-normal">
                        {role.system_prompt}
                      </p>
                    </div>
                  );
                })}

                {/* Custom User Characters */}
                {Object.entries(customRoles).map(([id, role]) => {
                  const isSelected = activeRoster.includes(id);
                  const ui = getRoleUI(id);
                  const Icon = ui.icon;

                  return (
                    <div
                      key={id}
                      onClick={() => toggleRoleSelection(id)}
                      className={`relative p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between group ${
                        isSelected 
                          ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/10 shadow-sm' 
                          : 'bg-white/80 border-neutral-200/80 hover:border-neutral-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${ui.color} shadow-2xs`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-neutral-900 text-sm tracking-tight">{role.display_name}</h4>
                              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-full border border-indigo-100">
                                Custom
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-md">
                              {role.model}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomCharacter(id);
                            }}
                            className="text-neutral-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Character"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? 'bg-indigo-600 text-white' : 'border border-neutral-300 group-hover:border-neutral-400'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-500 mt-3 line-clamp-2 leading-relaxed font-normal">
                        {role.system_prompt}
                      </p>
                    </div>
                  );
                })}

                {/* Create Character Trigger Card */}
                <div
                  onClick={() => setIsCreateCharacterModalOpen(true)}
                  className="p-5 rounded-2xl border-2 border-dashed border-neutral-200 hover:border-neutral-400 bg-white/40 hover:bg-white cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2 min-h-[120px] group"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-600 flex items-center justify-center transition-colors">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 text-sm">Create New Character</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Build a persona with custom expertise & tone</p>
                  </div>
                </div>

              </div>

              {/* Preset Scenarios */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass size={14} /> Or Start With Preset Assemblies
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PRESET_SCENES.map((scene, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setActiveRoster(scene.roles);
                        handleSend(scene.prompt);
                      }}
                      className="text-left bg-neutral-50 hover:bg-neutral-100 p-3.5 rounded-xl border border-neutral-200/60 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="font-semibold text-neutral-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors">
                          {scene.name}
                        </div>
                        <div className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                          {scene.prompt}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        {scene.roles.map(r => {
                          const ui = getRoleUI(r);
                          return (
                            <span key={r} title={ui.name} className={`w-5 h-5 rounded-full ${ui.color} text-white flex items-center justify-center text-[9px] font-bold`}>
                              {ui.name.charAt(0)}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Generator Panel Option */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 text-sm">AI Persona Auto-Generator</h4>
                    <p className="text-xs text-neutral-500">Describe a scenario and let AI assemble tailored specialist roles</p>
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
                    placeholder="e.g. A team debating sustainable packaging materials..."
                    className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-800 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    disabled={isGeneratingRoles}
                  />
                  <button
                    onClick={handleGenerateRoles}
                    disabled={!scenePrompt.trim() || isGeneratingRoles}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {isGeneratingRoles ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap size={14} /> Generate
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* MESSAGE LOG */}
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

      {/* FLOATING MINIMAL INPUT BAR */}
      <div className="bg-white/95 backdrop-blur-md border-t border-neutral-200/80 p-4 z-20">
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
            placeholder={
              activeRoster.length > 0 
                ? "Describe your idea, ask the panel a question, or trigger a debate..." 
                : "Select at least one character above to start brainstorming..."
            }
            className={`w-full bg-neutral-50 border border-neutral-200/90 rounded-2xl pl-5 pr-14 py-3.5 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:bg-white transition-all shadow-2xs resize-none min-h-[52px] max-h-32 ${
              activeRoster.length === 0 ? 'opacity-50 bg-neutral-100 cursor-not-allowed' : ''
            }`}
            rows={1}
            disabled={isProcessing || !roomId || activeRoster.length === 0}
          />
          
          {isProcessing ? (
            <button
              onClick={handleCancel}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-xl transition-colors shadow-2xs animate-pulse"
              title="Cancel generation"
            >
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !roomId || activeRoster.length === 0}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-neutral-900 hover:bg-neutral-800 text-white p-2 rounded-xl disabled:opacity-30 transition-colors shadow-2xs"
            >
              <Send size={16} />
            </button>
          )}
        </div>

        <div className="text-center mt-2 flex items-center justify-center gap-3">
          {isProcessing && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full text-[11px] font-semibold transition-colors border border-rose-100 shadow-2xs animate-pulse"
            >
              <span className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-ping" />
              <span>Cancel Stream</span>
            </button>
          )}
          <span className="text-[11px] text-neutral-400 font-medium">Shift + Enter for line break</span>
        </div>
      </div>

      {/* CREATE CUSTOM CHARACTER MODAL */}
      <AnimatePresence>
        {isCreateCharacterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-neutral-200"
            >
              <div className="flex items-center justify-between p-5 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <PlusCircle size={20} />
                  </div>
                  <h3 className="text-base font-bold text-neutral-900">Create Custom Character</h3>
                </div>
                <button 
                  onClick={() => setIsCreateCharacterModalOpen(false)} 
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-left overflow-y-auto max-h-[75vh]">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Character Name
                  </label>
                  <input 
                    type="text" 
                    value={newCharacter.display_name}
                    onChange={e => setNewCharacter({ ...newCharacter, display_name: e.target.value })}
                    placeholder="e.g. Growth Strategist, Security Auditor, Steve Jobs Persona..."
                    className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    System Prompt / Persona Instructions
                  </label>
                  <textarea 
                    value={newCharacter.system_prompt}
                    onChange={e => setNewCharacter({ ...newCharacter, system_prompt: e.target.value })}
                    placeholder="Describe how this persona behaves, their background, tone, and focus during discussions..."
                    className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[90px] leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                    Color Badge Accent
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewCharacter({ ...newCharacter, color: c.value })}
                        className={`w-7 h-7 rounded-full ${c.value} transition-all flex items-center justify-center text-white ${
                          newCharacter.color === c.value ? 'ring-2 ring-offset-2 ring-neutral-800 scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        {newCharacter.color === c.value && <Check size={12} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    LLM Engine Model
                  </label>
                  <select
                    value={newCharacter.model}
                    onChange={e => setNewCharacter({ ...newCharacter, model: e.target.value })}
                    className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
                  >
                    <option value="mistral-large-latest">mistral-large-latest (Reasoning)</option>
                    <option value="mistral-small-latest">mistral-small-latest (Fast)</option>
                    <option value="open-mixtral-8x22b">open-mixtral-8x22b (Creative)</option>
                    <option value="codestral-latest">codestral-latest (Technical)</option>
                    <option value="open-mistral-nemo">open-mistral-nemo (Pragmatic)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end gap-2">
                <button 
                  onClick={() => setIsCreateCharacterModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateCustomCharacter}
                  disabled={!newCharacter.display_name.trim() || !newCharacter.system_prompt.trim()}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-2xs"
                >
                  <Plus size={14} /> Add to Room Roster
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANAGE CHARACTERS PANEL OVERLAY */}
      <AnimatePresence>
        {isManagePanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-neutral-200"
            >
              <div className="flex items-center justify-between p-5 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-neutral-100 text-neutral-800 rounded-lg">
                    <Users size={18} />
                  </div>
                  <h3 className="text-base font-bold text-neutral-900">Manage Room Characters</h3>
                </div>
                <button 
                  onClick={() => setIsManagePanelOpen(false)} 
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-6 flex-1">
                {/* Built-in Characters */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    Built-In Personas
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.entries(availableRoles).map(([id, role]) => {
                      const isSelected = activeRoster.includes(id);
                      const ui = getRoleUI(id);
                      const Icon = ui.icon;

                      return (
                        <div
                          key={id}
                          onClick={() => toggleRoleSelection(id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                            isSelected 
                              ? 'bg-neutral-50 border-neutral-900 ring-1 ring-neutral-900/10' 
                              : 'bg-white border-neutral-200/80 hover:border-neutral-300'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white ${ui.color}`}>
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-neutral-900 truncate">{role.display_name}</span>
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                isSelected ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
                              }`}>
                                {isSelected && <Check size={10} strokeWidth={3} />}
                              </div>
                            </div>
                            <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">{role.system_prompt}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom User Personas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                      Custom Personas ({Object.keys(customRoles).length})
                    </h4>
                    <button
                      onClick={() => {
                        setIsManagePanelOpen(false);
                        setIsCreateCharacterModalOpen(true);
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Plus size={14} /> New Persona
                    </button>
                  </div>

                  {Object.keys(customRoles).length === 0 ? (
                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 text-center text-xs text-neutral-400">
                      No custom personas created yet. Click above to build your first custom character!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {Object.entries(customRoles).map(([id, role]) => {
                        const isSelected = activeRoster.includes(id);
                        const ui = getRoleUI(id);
                        const Icon = ui.icon;

                        return (
                          <div
                            key={id}
                            onClick={() => toggleRoleSelection(id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                              isSelected 
                                ? 'bg-indigo-50/50 border-indigo-600 ring-1 ring-indigo-500/10' 
                                : 'bg-white border-neutral-200/80 hover:border-neutral-300'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white ${ui.color}`}>
                              <Icon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-neutral-900 truncate">{role.display_name}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCustomCharacter(id);
                                    }}
                                    className="text-neutral-400 hover:text-rose-600 p-0.5"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                    isSelected ? 'bg-indigo-600 text-white' : 'border border-neutral-300'
                                  }`}>
                                    {isSelected && <Check size={10} strokeWidth={3} />}
                                  </div>
                                </div>
                              </div>
                              <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">{role.system_prompt}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
                <button 
                  onClick={() => setIsManagePanelOpen(false)}
                  className="bg-neutral-900 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors"
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
