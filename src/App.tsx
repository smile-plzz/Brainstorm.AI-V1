/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Users, Sparkles, User, BrainCircuit, Wrench, Heart, Download, 
  RefreshCcw, Settings, Plus, X, Check, Trash2, MessageSquare, Zap, Sliders, Shield, Compass, Lightbulb, PlusCircle,
  Search, Filter, TrendingUp, Cpu, Palette, DollarSign, Target, Globe, Terminal, Lock, Eye, Feather, Award, ChevronRight, Grid,
  Clock, Anchor, Wand2, Coffee, Music, Flame, Radio, Crown,
  Rocket, Utensils, Trophy, Ghost, Cat, Sun, Moon, Bot, Menu
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
  category?: string;
  color?: string;
  iconType?: string;
}

// Built-in role UI configurations with unique icons & colors
const ROLE_UI: Record<string, { name: string, color: string, icon: any, category: string }> = {
  user: { name: 'You', color: 'bg-blue-600', icon: User, category: 'General' },
  system: { name: 'System', color: 'bg-neutral-500', icon: Sparkles, category: 'General' },
  strategist: { name: 'The Strategist', color: 'bg-emerald-600', icon: BrainCircuit, category: 'Strategy & Leadership' },
  skeptic: { name: 'The Skeptical CFO', color: 'bg-rose-600', icon: Shield, category: 'Finance & Risk' },
  creative: { name: 'The Creative Director', color: 'bg-purple-600', icon: Lightbulb, category: 'Creative & Design' },
  executor: { name: 'The Operations Executor', color: 'bg-amber-600', icon: Compass, category: 'Strategy & Leadership' },
  technical_architect: { name: 'The Tech Architect', color: 'bg-indigo-600', icon: Wrench, category: 'Engineering & Product' },
  user_advocate: { name: 'The User Advocate', color: 'bg-teal-600', icon: Heart, category: 'Creative & Design' },
  growth_hacker: { name: 'The Growth Marketer', color: 'bg-cyan-600', icon: TrendingUp, category: 'Marketing & Sales' },
  security_auditor: { name: 'The Cybersecurity Specialist', color: 'bg-slate-700', icon: Lock, category: 'Engineering & Product' },
  product_designer: { name: 'The Product Designer', color: 'bg-fuchsia-600', icon: Palette, category: 'Creative & Design' },
  data_scientist: { name: 'The Data Scientist', color: 'bg-violet-600', icon: Cpu, category: 'Finance & Risk' },
  sales_strategist: { name: 'The Sales Strategist', color: 'bg-blue-600', icon: Target, category: 'Marketing & Sales' },
  futurist: { name: 'The Innovation Futurist', color: 'bg-sky-600', icon: Globe, category: 'Strategy & Leadership' },
  copywriter: { name: 'The Brand Copywriter', color: 'bg-orange-600', icon: Feather, category: 'Marketing & Sales' },
  devops_engineer: { name: 'The Cloud & SRE Lead', color: 'bg-neutral-800', icon: Terminal, category: 'Engineering & Product' },
  ethicist: { name: 'The AI Ethicist', color: 'bg-emerald-700', icon: Eye, category: 'Finance & Risk' },
  venture_capitalist: { name: 'The Venture Capitalist', color: 'bg-emerald-800', icon: DollarSign, category: 'Strategy & Leadership' },
  
  // Fun & Wild Characters
  time_traveler: { name: 'The Time Traveler', color: 'bg-violet-700', icon: Clock, category: 'Fun & Wild' },
  pirate_captain: { name: 'Captain Blackbeard', color: 'bg-amber-700', icon: Anchor, category: 'Fun & Wild' },
  wizard: { name: 'Archmage Merlin', color: 'bg-indigo-800', icon: Wand2, category: 'Fun & Wild' },
  noir_detective: { name: 'Hardboiled Detective', color: 'bg-neutral-800', icon: Coffee, category: 'Fun & Wild' },
  hype_man: { name: 'The Hype-Man DJ', color: 'bg-pink-600', icon: Music, category: 'Fun & Wild' },
  gen_z_critic: { name: 'Gen Z Trend Critic', color: 'bg-rose-500', icon: Flame, category: 'Fun & Wild' },
  conspiracy_theorist: { name: 'The Conspiracy Theorist', color: 'bg-yellow-700', icon: Radio, category: 'Fun & Wild' },
  renaissance_polymath: { name: 'Leonardo da Vinci', color: 'bg-amber-800', icon: Crown, category: 'Fun & Wild' },
  alien_observer: { name: 'Alien Anthropologist', color: 'bg-emerald-600', icon: Rocket, category: 'Fun & Wild' },
  medieval_bard: { name: 'Sir William the Bard', color: 'bg-orange-700', icon: Feather, category: 'Fun & Wild' },
  gourmet_chef: { name: 'Chef Auguste (3-Star)', color: 'bg-red-700', icon: Utensils, category: 'Fun & Wild' },
  action_hero: { name: 'Major John Maverick', color: 'bg-stone-800', icon: Zap, category: 'Fun & Wild' },
  zen_master: { name: 'Zen Master Bodhi', color: 'bg-teal-700', icon: Sun, category: 'Fun & Wild' },
  game_show_host: { name: 'Johnny Sparkles', color: 'bg-yellow-600', icon: Trophy, category: 'Fun & Wild' },
  victorian_ghost: { name: 'Lady Eleanor (Ghost)', color: 'bg-slate-800', icon: Ghost, category: 'Fun & Wild' },
  cat_philosopher: { name: 'Professor Whiskers', color: 'bg-amber-600', icon: Cat, category: 'Fun & Wild' },
  galactic_ai_overlord: { name: 'OVERLORD-9000', color: 'bg-cyan-700', icon: Bot, category: 'Fun & Wild' },
  superhero_vigilante: { name: 'The Night Guardian', color: 'bg-purple-950', icon: Moon, category: 'Fun & Wild' }
};

const COLOR_OPTIONS = [
  { name: 'Indigo', value: 'bg-indigo-600' },
  { name: 'Emerald', value: 'bg-emerald-600' },
  { name: 'Purple', value: 'bg-purple-600' },
  { name: 'Rose', value: 'bg-rose-600' },
  { name: 'Amber', value: 'bg-amber-600' },
  { name: 'Cyan', value: 'bg-cyan-600' },
  { name: 'Teal', value: 'bg-teal-600' },
  { name: 'Violet', value: 'bg-violet-600' }
];

const CATEGORIES = [
  'All',
  'Fun & Wild',
  'Strategy & Leadership',
  'Engineering & Product',
  'Creative & Design',
  'Marketing & Sales',
  'Finance & Risk',
  'Custom'
];

const PRESET_SCENES = [
  { name: 'Multiverse Panel', roles: ['time_traveler', 'pirate_captain', 'wizard', 'hype_man', 'gen_z_critic'], prompt: "Let's pitch an outlandish new product idea to a wild cross-dimensional panel!" },
  { name: 'Ultimate Chaos Court', roles: ['alien_observer', 'gourmet_chef', 'cat_philosopher', 'game_show_host', 'victorian_ghost'], prompt: "Present a simple everyday human activity and let this absurd panel dissect it!" },
  { name: 'Startup Pitch', roles: ['strategist', 'skeptic', 'creative', 'venture_capitalist'], prompt: "Help me refine my startup pitch and challenge my core assumptions." },
  { name: 'Architecture & Security', roles: ['technical_architect', 'security_auditor', 'devops_engineer'], prompt: "Let's review the technical scalability and cloud security of a real-time web platform." },
  { name: 'Product Launch', roles: ['product_designer', 'growth_hacker', 'copywriter', 'user_advocate'], prompt: "We need an integrated launch strategy, branding, and user onboarding plan for our application." }
];

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
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
      if (saved) {
        const parsed = JSON.parse(saved);
        // Fix any old personas that were incorrectly marked as Fun & Wild
        Object.values(parsed).forEach((role: any) => {
          if (role.category === 'Fun & Wild') {
            role.category = 'Custom';
          }
        });
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  });
  
  const [activeRoster, setActiveRoster] = useState<string[]>([]);
  const [isManagePanelOpen, setIsManagePanelOpen] = useState(false);
  const [isSeeMoreModalOpen, setIsSeeMoreModalOpen] = useState(false);
  const [isCreateCharacterModalOpen, setIsCreateCharacterModalOpen] = useState(false);

  // Character Modal Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Custom Role Form State
  const [newCharacter, setNewCharacter] = useState({
    display_name: '',
    system_prompt: '',
    category: 'Strategy & Leadership',
    color: 'bg-indigo-600',
    model: 'mistral-large-latest',
    temperature: 0.7
  });

  const [isGeneratingRoles, setIsGeneratingRoles] = useState(false);
  const [scenePrompt, setScenePrompt] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);
  const [isSkipStream, setIsSkipStream] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleGenerateRoles = async (overridePrompt?: string) => {
    const promptToUse = overridePrompt || scenePrompt;
    if (!promptToUse.trim() || isGeneratingRoles) return;
    setIsGeneratingRoles(true);
    try {
      const res = await fetch('/api/generate-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: promptToUse })
      });
      const data = await res.json();
      if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
        const newCustomRoles: Record<string, CharacterConfig> = {};
        const newRoster: string[] = [];
        data.roles.forEach((r: any, idx: number) => {
          const charId = r.id ? `custom_${r.id}` : `custom_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
          newCustomRoles[charId] = {
            display_name: r.display_name || 'AI Persona',
            model: r.model || 'mistral-large-latest',
            system_prompt: r.system_prompt || `Specialist persona evaluating ${promptToUse}.`,
            temperature: r.temperature || 0.7,
            category: 'Custom',
            color: COLOR_OPTIONS[idx % COLOR_OPTIONS.length].value
          };
          newRoster.push(charId);
        });
        setCustomRoles(prev => ({ ...prev, ...newCustomRoles }));
        setActiveRoster(newRoster);
        setScenePrompt('');
        
        const topicSnippet = promptToUse.length > 28 ? promptToUse.slice(0, 28) + '...' : promptToUse;
        setNotification(`Created ${data.roles.length} relevant personas for "${topicSnippet}"!`);
        setTimeout(() => setNotification(null), 4500);

        // Start chat automatically
        const nextCustomRoles = { ...customRoles, ...newCustomRoles };
        const nextRoster = newRoster;
        handleSend(`Let's discuss: ${promptToUse}`, false, nextRoster, nextCustomRoles, promptToUse);
      } else {
        console.error('Role generation response issue:', data);
        setNotification('Could not generate personas for that topic. Please try again.');
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (err) {
      console.error('Failed to generate roles:', err);
      setNotification('Failed to generate roles. Please check network connection.');
      setTimeout(() => setNotification(null), 3500);
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
      category: newCharacter.category || 'Custom',
      color: newCharacter.color,
      model: newCharacter.model,
      temperature: newCharacter.temperature
    };

    setCustomRoles(prev => ({ ...prev, [charId]: createdConfig }));
    setActiveRoster(prev => [...prev, charId]);
    setNewCharacter({
      display_name: '',
      system_prompt: '',
      category: 'Strategy & Leadership',
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

  const handleSend = async (overrideInput?: string, isAutoRun = false, explicitRoster?: string[], explicitCustomRoles?: Record<string, CharacterConfig>, explicitThreadName?: string) => {
    const userText = overrideInput || input;
    const currentRoster = explicitRoster || activeRoster;
    const currentCustomRoles = explicitCustomRoles || customRoles;
    
    if (!userText.trim() || !roomId || isProcessing || currentRoster.length === 0) return;

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
          roster: currentRoster,
          customRoles: currentCustomRoles,
          fastMode: isFastMode,
          isAutopilot: isAutoRun,
          skipStream: isSkipStream,
          threadName: explicitThreadName
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
        icon: User,
        category: customRoles[speaker].category || 'Custom'
      };
    }
    if (availableRoles[speaker]) {
      return { 
        name: availableRoles[speaker].display_name, 
        color: 'bg-neutral-600', 
        icon: BrainCircuit,
        category: availableRoles[speaker].category || 'General'
      };
    }
    return { name: speaker, color: 'bg-neutral-600', icon: User, category: 'General' };
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

  const allRoleKeys = useMemo(() => {
    return Array.from(new Set([...Object.keys(availableRoles), ...Object.keys(customRoles)]));
  }, [availableRoles, customRoles]);

  // Combined character entries for searching and filtering in the See More Modal
  const allCharacterEntries = useMemo(() => {
    const map = new Map<string, { id: string, config: CharacterConfig, isCustom: boolean }>();
    Object.entries(availableRoles).forEach(([id, config]) => {
      map.set(id, { id, config, isCustom: false });
    });
    Object.entries(customRoles).forEach(([id, config]) => {
      map.set(id, { id, config, isCustom: true });
    });
    return Array.from(map.values());
  }, [availableRoles, customRoles]);

  const filteredCharacters = useMemo(() => {
    return allCharacterEntries.filter(item => {
      const matchesCategory = 
        selectedCategory === 'All' ? true :
        selectedCategory === 'Custom' ? item.isCustom :
        (item.config.category || ROLE_UI[item.id]?.category) === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.config.display_name.toLowerCase().includes(q) ||
        item.config.system_prompt.toLowerCase().includes(q) ||
        item.config.model.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [allCharacterEntries, selectedCategory, searchQuery]);

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
              className={`px-4 sm:px-5 py-3.5 rounded-2xl text-[14px] sm:text-[14.5px] leading-relaxed transition-all ${
                isUser 
                  ? 'bg-neutral-900 text-white rounded-tr-xs shadow-sm' 
                  : isSystem
                    ? 'bg-neutral-100 text-neutral-600 italic rounded-tl-xs border border-neutral-200/80'
                    : 'bg-white text-neutral-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-200/80 rounded-tl-xs prose prose-sm sm:prose-slate max-w-none break-words'
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
      
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 right-4 z-50 bg-neutral-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-neutral-700/60 max-w-md"
          >
            <div className="p-1 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Sparkles size={18} />
            </div>
            <p className="text-xs font-medium text-neutral-100 flex-1">{notification}</p>
            <button 
              onClick={() => setNotification(null)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Sleek Minimalist Glass Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-neutral-200/80 py-3.5 px-4 sm:px-6 flex items-center justify-between z-20 sticky top-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 p-2 rounded-xl text-white shadow-xs">
            <BrainCircuit size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-neutral-900 tracking-tight">Brainstorm Studio</h1>
              <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200/60 truncate max-w-[200px] sm:max-w-xs">
                {room?.niche || 'AI Panel'}
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
          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/60 rounded-xl transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu size={16} />
          </button>

          <div className="hidden lg:flex items-center gap-2">
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
              onClick={() => setIsSeeMoreModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-2xs"
              title="Browse Full Character Library"
            >
              <Grid size={14} />
              <span className="hidden sm:inline">Library</span>
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
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl disabled:opacity-30 transition-colors hidden sm:flex"
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

      {/* Mobile Collapsible Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden bg-white border-b border-neutral-200/80 overflow-hidden z-10"
          >
            <div className="p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="crossTalkMobile" className="text-xs text-neutral-500 font-medium">Cross-talk Dynamics</label>
                <select
                  id="crossTalkMobile"
                  value={crossTalkLevel}
                  onChange={(e) => setCrossTalkLevel(e.target.value as 'low' | 'medium' | 'high')}
                  className="text-sm bg-neutral-100 hover:bg-neutral-200/60 border border-neutral-200/80 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-neutral-800 font-medium transition-colors w-full"
                  disabled={isProcessing}
                >
                  <option value="low">Low Dynamics</option>
                  <option value="medium">Medium Dynamics</option>
                  <option value="high">High Dynamics</option>
                </select>
              </div>

              <div className="flex flex-col gap-3 pt-2 border-t border-neutral-100">
                <label className="flex items-center justify-between text-sm text-neutral-700 font-medium cursor-pointer">
                  <span>Autopilot Mode</span>
                  <input 
                    type="checkbox" 
                    checked={isAutopilot} 
                    onChange={e => setIsAutopilot(e.target.checked)} 
                    className="w-4 h-4 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-800"
                  />
                </label>
                <label className="flex items-center justify-between text-sm text-neutral-700 font-medium cursor-pointer">
                  <span>Fast Mode</span>
                  <input 
                    type="checkbox" 
                    checked={isFastMode} 
                    onChange={e => setIsFastMode(e.target.checked)} 
                    className="w-4 h-4 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-800"
                  />
                </label>
                <label className="flex items-center justify-between text-sm text-neutral-700 font-medium cursor-pointer">
                  <span>Instant Text (Skip Stream)</span>
                  <input 
                    type="checkbox" 
                    checked={isSkipStream} 
                    onChange={e => setIsSkipStream(e.target.checked)} 
                    className="w-4 h-4 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-800"
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-header Active Character Strip when actively conversing */}
      {messages.length > 0 && (
        <div className="bg-white/80 border-b border-neutral-200/60 px-4 py-2 flex items-center justify-between overflow-x-auto text-xs gap-3 no-scrollbar">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px] flex-shrink-0">Active Roster:</span>
            {activeRoster.map(id => {
              const conf = getRoleUI(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleRoleSelection(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${conf.color} text-white shadow-2xs`}
                >
                  <span className="truncate max-w-[120px]">{conf.name}</span>
                  <X size={12} className="hover:opacity-80" />
                </button>
              );
            })}
            <button
              onClick={() => setIsSeeMoreModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 rounded-full border border-neutral-200/80 font-medium transition-colors text-xs flex-shrink-0"
            >
              <Plus size={12} /> Add Characters ({allRoleKeys.length})
            </button>
          </div>
        </div>
      )}

      {/* Chat Body & Initial Load Hub */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          
          {/* INITIAL LOAD: CHARACTER SELECTION HUB */}
          {messages.length === 0 && (
            <div className="space-y-8 my-4">
              
              {/* Hero Banner */}
              <div className="text-center max-w-xl mx-auto space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                  <Sparkles size={14} /> Multi-Agent AI Brainstorming
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                  Choose Your AI Characters
                </h2>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Select specialists to join your brainstorming panel. Toggle roles easily or open the full library to explore all options.
                </p>
              </div>

              {/* Featured Characters Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-b border-neutral-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} /> Featured Roster
                  </h3>
                  <span className="px-2.5 py-0.5 bg-neutral-900 text-white rounded-full text-xs font-bold">
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
                    onClick={() => setIsSeeMoreModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-3.5 py-1.5 rounded-xl transition-all shadow-2xs"
                  >
                    <Grid size={14} /> See More Characters ({allRoleKeys.length})
                  </button>
                </div>
              </div>

              {/* Initial Load Featured Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                
                {/* Render top featured/active roles first */}
                {Object.entries(availableRoles).slice(0, 5).map(([id, role]) => {
                  const isSelected = activeRoster.includes(id);
                  const ui = getRoleUI(id);
                  const Icon = ui.icon;

                  return (
                    <div
                      key={id}
                      onClick={() => toggleRoleSelection(id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between group ${
                        isSelected 
                          ? 'bg-white border-neutral-900 ring-2 ring-neutral-900/10 shadow-sm' 
                          : 'bg-white/80 border-neutral-200/80 hover:border-neutral-300 hover:bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${ui.color} shadow-2xs`}>
                            <Icon size={16} />
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? 'bg-neutral-900 text-white' : 'border border-neutral-300 group-hover:border-neutral-400'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>

                        <h4 className="font-bold text-neutral-900 text-sm tracking-tight">{role.display_name}</h4>
                        <span className="inline-block text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md mt-1">
                          {role.category || ui.category}
                        </span>
                        
                        <p className="text-xs text-neutral-500 mt-2.5 line-clamp-2 leading-relaxed font-normal">
                          {role.system_prompt}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Big Prominent "See More Characters" Tile */}
                <div
                  onClick={() => setIsSeeMoreModalOpen(true)}
                  className="p-5 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2 group min-h-[140px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm">
                    <Grid size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 text-sm flex items-center justify-center gap-1">
                      See More Characters <ChevronRight size={16} className="text-indigo-600 group-hover:translate-x-1 transition-transform" />
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">Explore {allRoleKeys.length}+ specialist personas & custom roles</p>
                  </div>
                </div>

              </div>

              {/* Preset Scenarios */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass size={14} /> Quick Start Assemblies
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
              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">AI Persona Auto-Generator</h4>
                      <p className="text-xs text-neutral-500">Describe a custom scenario or click a fun topic below to generate wild personas</p>
                    </div>
                  </div>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { label: '🚀 Galactic Council', prompt: 'A diplomatic council of alien ambassadors debating cosmic laws' },
                    { label: '🏴‍☠️ Pirates vs Ninjas', prompt: 'A crew of buccaneer pirates and shadow ninjas negotiating a treaty' },
                    { label: '🔮 Magic Academy', prompt: 'Archmages and alchemy professors reviewing a high-level spellcraft invention' },
                    { label: '🍳 Wild Cooking Contest', prompt: 'Eccentric gourmet judges reviewing an otherworldly culinary dish' },
                    { label: '🏛️ Ancient Senate', prompt: 'Senators and philosophers debating modern technology in ancient Rome' }
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleGenerateRoles(chip.prompt)}
                      disabled={isGeneratingRoles}
                      className="text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 px-2.5 py-1 rounded-lg border border-neutral-200/60 transition-colors disabled:opacity-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateRoles();
                    }}
                    placeholder="e.g. A team debating sustainable electric aviation or time travel paradoxes..."
                    className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-800 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    disabled={isGeneratingRoles}
                  />
                  <button
                    onClick={() => handleGenerateRoles()}
                    disabled={!scenePrompt.trim() || isGeneratingRoles}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
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

      {/* SEE MORE CHARACTERS MODAL (BROAD CHARACTER LIBRARY) */}
      <AnimatePresence>
        {isSeeMoreModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-neutral-200/90 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-neutral-200/80 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-neutral-900 text-white rounded-xl shadow-2xs">
                      <Grid size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-neutral-900 tracking-tight">Character Library</h3>
                      <p className="text-xs text-neutral-500 font-medium">
                        {activeRoster.length} of {allRoleKeys.length} characters active in room
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsSeeMoreModalOpen(false);
                      setIsCreateCharacterModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl transition-colors shadow-2xs"
                  >
                    <Plus size={14} /> Create Character
                  </button>
                  <button 
                    onClick={() => setIsSeeMoreModalOpen(false)} 
                    className="p-2 hover:bg-neutral-200/60 rounded-xl text-neutral-400 hover:text-neutral-700 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="p-4 bg-white border-b border-neutral-200/60 space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search characters by name, role, or expertise keywords..."
                    className="w-full bg-neutral-50 border border-neutral-200/90 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-800 transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pb-1 text-xs">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all text-xs ${
                        selectedCategory === cat 
                          ? 'bg-neutral-900 text-white shadow-2xs' 
                          : 'bg-neutral-100 hover:bg-neutral-200/70 text-neutral-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Character Grid */}
              <div className="flex-1 overflow-y-auto p-5 bg-[#FAF9FB]">
                {filteredCharacters.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400 space-y-2">
                    <Users size={32} className="mx-auto text-neutral-300" />
                    <p className="text-sm font-semibold text-neutral-600">No characters found matching "{searchQuery}"</p>
                    <p className="text-xs">Try searching for a different keyword or category.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filteredCharacters.map(({ id, config, isCustom }) => {
                      const isSelected = activeRoster.includes(id);
                      const ui = getRoleUI(id);
                      const Icon = ui.icon;

                      return (
                        <div
                          key={id}
                          onClick={() => toggleRoleSelection(id)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between group relative ${
                            isSelected 
                              ? 'bg-white border-neutral-900 ring-2 ring-neutral-900/10 shadow-sm' 
                              : 'bg-white border-neutral-200/80 hover:border-neutral-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${ui.color} shadow-2xs`}>
                                  <Icon size={16} />
                                </div>
                                {isCustom && (
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded-full">
                                    Custom
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isCustom && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCustomCharacter(id);
                                    }}
                                    className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Delete Character"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                  isSelected ? 'bg-neutral-900 text-white' : 'border border-neutral-300 group-hover:border-neutral-400'
                                }`}>
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                              </div>
                            </div>

                            <h4 className="font-bold text-neutral-900 text-sm tracking-tight">{config.display_name}</h4>
                            
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                                {config.category || ui.category}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400">
                                {config.model}
                              </span>
                            </div>

                            <p className="text-xs text-neutral-500 mt-2.5 line-clamp-3 leading-relaxed">
                              {config.system_prompt}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-neutral-200/80 bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <span>{activeRoster.length} active in panel</span>
                  <button
                    onClick={() => setActiveRoster(allRoleKeys)}
                    className="text-neutral-500 hover:text-neutral-900 underline ml-2"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setActiveRoster([])}
                    className="text-neutral-500 hover:text-neutral-900 underline"
                  >
                    Clear All
                  </button>
                </div>

                <button
                  onClick={() => setIsSeeMoreModalOpen(false)}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors shadow-2xs"
                >
                  Confirm Selection
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    Category Domain
                  </label>
                  <select
                    value={newCharacter.category}
                    onChange={e => setNewCharacter({ ...newCharacter, category: e.target.value })}
                    className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-medium"
                  >
                    <option value="Strategy & Leadership">Strategy & Leadership</option>
                    <option value="Engineering & Product">Engineering & Product</option>
                    <option value="Creative & Design">Creative & Design</option>
                    <option value="Marketing & Sales">Marketing & Sales</option>
                    <option value="Finance & Risk">Finance & Risk</option>
                    <option value="Custom">Custom</option>
                  </select>
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
                  <Plus size={14} /> Add to Character Library
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
