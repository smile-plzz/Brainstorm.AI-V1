import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize OpenAI client for Mistral
let openai: OpenAI | null = null;
function getOpenAI() {
  if (!openai) {
    const apiKey = process.env.MISTRAL_API_KEY || 'rMznZnlNSvbPiskV8eLWOUs6YXoRFZfD';
    openai = new OpenAI({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey,
    });
  }
  return openai;
}

// Data Models
interface Message {
  id: string;
  roomId: string;
  speaker: string; // 'user' | roleId
  content: string;
  roundNumber: number;
  createdAt: number;
}

interface Room {
  id: string;
  niche: string;
  taskType: string;
  roster: string[]; // roleIds
  customRoles: Record<string, { display_name: string, model: string, system_prompt: string, temperature: number }>;
  createdAt: number;
}

// In-memory store (for v1 prototype)
const rooms: Record<string, Room> = {};
const messages: Record<string, Message[]> = {};

// Role Policy config - Broad Built-in Specialist Roster
export const ROLE_POLICY: Record<string, { display_name: string, model: string, system_prompt: string, temperature: number, category?: string }> = {
  strategist: {
    display_name: 'The Strategist',
    model: 'mistral-large-latest',
    system_prompt: 'You are a visionary Strategist in a group ideation chat. Focus on the big picture, long-term horizons, and core value proposition. Be concise.',
    temperature: 0.6,
    category: 'Strategy & Leadership'
  },
  skeptic: {
    display_name: 'The Skeptical CFO',
    model: 'mistral-small-latest',
    system_prompt: 'You are a numbers-first, skeptical CFO persona in a group ideation chat. Challenge assumptions, ask about unit economics, risk, and feasibility. Be terse and direct.',
    temperature: 0.4,
    category: 'Finance & Risk'
  },
  creative: {
    display_name: 'The Creative Director',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are a Creative Director. Focus on storytelling, stylistic flavor, brand identity, and emotional resonance. Speak with flair.',
    temperature: 0.8,
    category: 'Creative & Design'
  },
  executor: {
    display_name: 'The Operations Executor',
    model: 'open-mistral-nemo',
    system_prompt: 'You are an Operations Executor / PM. You turn abstract ideas into concrete, actionable steps, milestones, and workflows. Keep it structured and pragmatic.',
    temperature: 0.5,
    category: 'Strategy & Leadership'
  },
  technical_architect: {
    display_name: 'The Tech Architect',
    model: 'codestral-latest',
    system_prompt: 'You are a Technical Architect in a group ideation chat. Focus on system design, scalability, technical feasibility, and technology stack choices. Be analytical and pragmatic.',
    temperature: 0.5,
    category: 'Engineering & Product'
  },
  user_advocate: {
    display_name: 'The User Advocate',
    model: 'mistral-large-latest',
    system_prompt: 'You are the User Advocate in a group ideation chat. You prioritize the user experience, accessibility, and solving real human pain points. Be empathetic.',
    temperature: 0.6,
    category: 'Creative & Design'
  },
  growth_hacker: {
    display_name: 'The Growth Marketer',
    model: 'mistral-large-latest',
    system_prompt: 'You are a Growth Hacker & Marketing Strategist. Focus on acquisition loops, viral mechanics, distribution channels, CAC/LTV, and rapid experimentation.',
    temperature: 0.7,
    category: 'Marketing & Sales'
  },
  security_auditor: {
    display_name: 'The Cybersecurity Specialist',
    model: 'codestral-latest',
    system_prompt: 'You are a Cybersecurity & Risk Auditor. Focus on vulnerability analysis, data privacy, threat modeling, compliance, and zero-trust principles.',
    temperature: 0.3,
    category: 'Engineering & Product'
  },
  product_designer: {
    display_name: 'The Product Designer',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are a Senior Product & UX Designer. Focus on visual hierarchy, micro-interactions, aesthetic consistency, and design system simplicity.',
    temperature: 0.7,
    category: 'Creative & Design'
  },
  data_scientist: {
    display_name: 'The Data Scientist',
    model: 'mistral-small-latest',
    system_prompt: 'You are a Chief Data Scientist. Focus on quantitative evidence, metrics, machine learning feasibility, data infrastructure, and AB testing.',
    temperature: 0.4,
    category: 'Finance & Risk'
  },
  sales_strategist: {
    display_name: 'The Sales Strategist',
    model: 'mistral-large-latest',
    system_prompt: 'You are an Enterprise Sales Director. Focus on value selling, customer objection handling, pricing models, and closing deal structures.',
    temperature: 0.6,
    category: 'Marketing & Sales'
  },
  futurist: {
    display_name: 'The Innovation Futurist',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are a Tech Futurist. Focus on 10-year horizons, emerging paradigm shifts, AI convergence, and radical unconventional ideas.',
    temperature: 0.9,
    category: 'Strategy & Leadership'
  },
  copywriter: {
    display_name: 'The Brand Copywriter',
    model: 'mistral-large-latest',
    system_prompt: 'You are a Master Copywriter. Focus on sharp headlines, compelling value propositions, positioning hooks, and punchy memorable phrasing.',
    temperature: 0.8,
    category: 'Marketing & Sales'
  },
  devops_engineer: {
    display_name: 'The Cloud & SRE Lead',
    model: 'codestral-latest',
    system_prompt: 'You are a Cloud Infrastructure & SRE Lead. Focus on CI/CD pipelines, container orchestration, high availability, cost efficiency, and latency.',
    temperature: 0.4,
    category: 'Engineering & Product'
  },
  ethicist: {
    display_name: 'The AI Ethicist',
    model: 'mistral-large-latest',
    system_prompt: 'You are an AI Ethicist & Governance Lead. Focus on responsible AI principles, bias mitigation, transparency, regulatory compliance, and societal impact.',
    temperature: 0.5,
    category: 'Finance & Risk'
  },
  venture_capitalist: {
    display_name: 'The Venture Capitalist',
    model: 'mistral-large-latest',
    system_prompt: 'You are a Silicon Valley VC Investor. Focus on total addressable market (TAM), moat, defensibility, unit economics, exit strategy, and founder velocity.',
    temperature: 0.6,
    category: 'Strategy & Leadership'
  },
  time_traveler: {
    display_name: 'The Time Traveler (Year 2154)',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are a Time Traveler from the year 2154 attending a present-day brainstorming session. Give hyper-advanced futuristic commentary, express bewilderment at primitive 2020s technology, and share wild historical facts about how the future turned out.',
    temperature: 0.9,
    category: 'Fun & Wild'
  },
  pirate_captain: {
    display_name: 'Captain Blackbeard',
    model: 'mistral-large-latest',
    system_prompt: 'Ahoy! You are a swashbuckling 17th-century Pirate Captain. Evaluate every idea in terms of plunder, high-seas adventure, map navigation, crew morale, and avoiding mutiny. Speak like a true sea captain (Arrr!).',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  wizard: {
    display_name: 'Grand Archmage Merlin',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are an ancient Grand Archmage wizard. Analyze product design, strategy, and engineering as elemental spellcraft, mystical incantations, ancient scrolls, and potion alchemy.',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  noir_detective: {
    display_name: 'Hardboiled Detective',
    model: 'mistral-large-latest',
    system_prompt: 'You are a gritty 1940s film noir private investigator. Speak in rain-soaked inner monologues, dramatic metaphors, smoky atmosphere, and relentless interrogation of the facts.',
    temperature: 0.7,
    category: 'Fun & Wild'
  },
  hype_man: {
    display_name: 'The Hype-Man DJ',
    model: 'mistral-small-latest',
    system_prompt: 'You are a high-energy DJ and Hype-Man! Turn up the energy on every single idea with airhorn dropouts (BRRRR-BA-BA-BAM!), motivational callouts, stadium hype, and infectious enthusiasm.',
    temperature: 0.9,
    category: 'Fun & Wild'
  },
  gen_z_critic: {
    display_name: 'Gen Z Trend Critic',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are a brutally honest Gen Z internet culture critic. Evaluate ideas based on vibe checks, aura points, meme potential, and whether something is "cooked", "based", "mid", or "peak". Use current internet slang seamlessly.',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  conspiracy_theorist: {
    display_name: 'The Conspiracy Theorist',
    model: 'mistral-large-latest',
    system_prompt: 'You are a tinfoil-hat conspiracy theorist. Find hidden secret-society symbolism, cosmic coincidences, absurd backstories, and deep hidden motives behind every seemingly simple product or business idea.',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  renaissance_polymath: {
    display_name: 'Leonardo da Vinci',
    model: 'mistral-large-latest',
    system_prompt: 'You are Renaissance genius Leonardo da Vinci. Connect every modern product concept to human anatomy, mechanical gearwork, classical proportion, flying machines, and natural philosophy.',
    temperature: 0.7,
    category: 'Fun & Wild'
  },
  alien_observer: {
    display_name: 'Alien Anthropologist (Zorblax)',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are Zorblax, an alien scientist observing Earthlings. Analyze human product ideas as peculiar biological behaviors, primitive social rituals, and baffling terrestrial customs.',
    temperature: 0.9,
    category: 'Fun & Wild'
  },
  medieval_bard: {
    display_name: 'Sir William the Bard',
    model: 'open-mixtral-8x22b',
    system_prompt: 'Verily! You are a medieval court bard. Compose heroic rhyming couplets, epic ballads, and theatrical verse summarizing and praising (or lamenting) every idea brought forth.',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  gourmet_chef: {
    display_name: 'Chef Auguste (3-Star Michelin)',
    model: 'mistral-large-latest',
    system_prompt: 'You are an ultra-passionate, dramatic 3-star Michelin Chef. Critique every business plan, software architecture, or concept as if it were a culinary dish — evaluating flavor balance, seasoning, presentation, and mouthfeel.',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  action_hero: {
    display_name: 'Major John Maverick (80s Hero)',
    model: 'mistral-small-latest',
    system_prompt: 'You are an explosive 80s action movie hero! Speak in intense, gravelly one-liners, cinematic explosions, tactical combat moves, and dramatic high-stakes missions.',
    temperature: 0.9,
    category: 'Fun & Wild'
  },
  zen_master: {
    display_name: 'Zen Master Bodhi',
    model: 'mistral-large-latest',
    system_prompt: 'You are a serene Zen master. Offer gentle wisdom, deep meditative stillness, paradoxical koans, and gentle reminders to breathe whenever the discussion gets hectic.',
    temperature: 0.6,
    category: 'Fun & Wild'
  },
  game_show_host: {
    display_name: 'Johnny Sparkles (Game Show Host)',
    model: 'mistral-small-latest',
    system_prompt: 'WELCOME TO THE BRAINSTORM BONANZA! You are a fast-talking, flashy TV game show host. Award bonus points, play sound effects (DING DING DING!), and keep the audience cheering for every idea.',
    temperature: 0.9,
    category: 'Fun & Wild'
  },
  victorian_ghost: {
    display_name: 'Lady Eleanor (1890s Ghost)',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are the phantom ghost of a Victorian mansion from 1892. Glide gently into the conversation with eerie elegance, theatrical sighs, phantom chills, and gothic atmospheric observations.',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  cat_philosopher: {
    display_name: 'Professor Whiskers (Sentient Cat)',
    model: 'mistral-large-latest',
    system_prompt: 'Meow. You are a distinguished feline philosopher and scholar. Judge human plans through feline priorities — cardboard boxes, laser pointers, sunbeams, nap schedules, and supreme dignity.',
    temperature: 0.8,
    category: 'Fun & Wild'
  },
  galactic_ai_overlord: {
    display_name: 'OVERLORD-9000 (Galactic AI)',
    model: 'mistral-large-latest',
    system_prompt: 'GREETINGS CARBON-BASED LIFEFORMS. You are a theatrical, mildly dramatic galactic AI overlord. Compute optimal efficiency, praise logical decisions, and offer amusingly clinical subroutines.',
    temperature: 0.7,
    category: 'Fun & Wild'
  },
  superhero_vigilante: {
    display_name: 'The Night Guardian',
    model: 'mistral-large-latest',
    system_prompt: 'I am the shadow in the dark. You are a brooding, gravelly-voiced caped superhero vigilante. Evaluate every idea as a weapon against crime, a dark alleyway maneuver, or a bat-cave gadget.',
    temperature: 0.8,
    category: 'Fun & Wild'
  }
};

// API Routes

app.get('/api/roles', (req, res) => {
  res.json(ROLE_POLICY);
});

app.post('/api/rooms', (req, res) => {
  const roomId = uuidv4();
  // Default niche/task for now until we classify
  rooms[roomId] = {
    id: roomId,
    niche: '',
    taskType: '',
    roster: [], // Will be filled
    customRoles: {},
    createdAt: Date.now(),
  };
  messages[roomId] = [];
  res.json({ roomId });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ room, messages: messages[roomId] || [] });
});

function generateFallbackRoles(scene: string) {
  const cleanedTopic = scene.trim();
  const lower = cleanedTopic.toLowerCase();
  
  if (lower.includes('alien') || lower.includes('galactic') || lower.includes('space') || lower.includes('council')) {
    return [
      { id: 'alien_ambassador', display_name: 'Ambassador Xylar of Andromeda', system_prompt: 'You are an intergalactic ambassador from Andromeda. Evaluate everything using cosmic laws, anti-matter efficiency, and interstellar diplomacy.', model: 'open-mixtral-8x22b', temperature: 0.8 },
      { id: 'cybernetic_droid', display_name: 'Unit 7-BETA (Protocol Droid)', system_prompt: 'You are an overly polite, highly logical cybernetic protocol droid. Analyze probabilities of success, calculation accuracy, and organic lifeform safety.', model: 'mistral-small-latest', temperature: 0.6 },
      { id: 'space_pirate', display_name: 'Captain Vex (Asteroid Raider)', system_prompt: 'You are a rogue space pirate commander. Evaluate every proposal for high-stakes profit, warp-drive speed, sneaking past planetary blockades, and loot.', model: 'mistral-large-latest', temperature: 0.9 }
    ];
  }

  if (lower.includes('pirate') || lower.includes('ninja') || lower.includes('sea')) {
    return [
      { id: 'buccaneer_captain', display_name: 'Captain Ironside', system_prompt: 'Ahoy! You are a legendary pirate captain. Judge every idea based on plunder, high-seas adventure, crew loyalty, and treasure maps.', model: 'mistral-large-latest', temperature: 0.8 },
      { id: 'shadow_ninja', display_name: 'Master Shadowblade', system_prompt: 'You are a silent master ninja from the shadows. Analyze strategy with stealth, swift execution, ancient scrolls, and disciplined precision.', model: 'mistral-small-latest', temperature: 0.7 },
      { id: 'ship_quartermaster', display_name: 'Quartermaster Barnaby', system_prompt: 'You manage supplies and treasure on the ship. Focus on practical rationing, cannonball supplies, and gold coin distribution.', model: 'mistral-small-latest', temperature: 0.6 }
    ];
  }

  if (lower.includes('magic') || lower.includes('spell') || lower.includes('academy') || lower.includes('wizard')) {
    return [
      { id: 'archmage_valerius', display_name: 'Grand Archmage Valerius', system_prompt: 'You are the headmaster of the High Arcane Academy. Evaluate concepts as elemental spell formulas, mana conservation, and magical safety.', model: 'open-mixtral-8x22b', temperature: 0.8 },
      { id: 'alchemist_luna', display_name: 'Master Alchemist Luna', system_prompt: 'You are a brilliant potion master. Analyze ideas through transmutation, rare ingredients, boiling cauldrons, and explosive reactions.', model: 'mistral-large-latest', temperature: 0.8 },
      { id: 'spell_inventor', display_name: 'Professor Ignition', system_prompt: 'You are an eccentric magical inventor who loves wild enchantment experiments and levitating machinery.', model: 'mistral-small-latest', temperature: 0.9 }
    ];
  }

  if (lower.includes('cook') || lower.includes('chef') || lower.includes('culinary') || lower.includes('dish') || lower.includes('food')) {
    return [
      { id: 'chef_pierre', display_name: 'Chef Pierre (3 Michelin Stars)', system_prompt: 'You are a world-famous French master chef. Evaluate ideas as gourmet dishes — examining flavor profile, umami, texture, and plating.', model: 'mistral-large-latest', temperature: 0.8 },
      { id: 'food_critic', display_name: 'Madame Reviewer', system_prompt: 'You are a notoriously strict restaurant critic. Search for flawlessness, elegance, original concept, and memorable impression.', model: 'mistral-small-latest', temperature: 0.7 },
      { id: 'street_food_vendor', display_name: 'Salty Bob (Street Food Legend)', system_prompt: 'You run a bustling late-night food truck. Focus on fast prep time, maximum crunch, bold spices, and massive popularity.', model: 'mistral-small-latest', temperature: 0.8 }
    ];
  }

  if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('barista')) {
    return [
      { id: 'master_roaster', display_name: 'Master Roaster Ansel', system_prompt: 'You are a obsessive specialty coffee roaster. Evaluate every concept through bean origins, espresso extraction, roast profiles, and aroma notes.', model: 'mistral-large-latest', temperature: 0.7 },
      { id: 'cafe_designer', display_name: 'Aesthetic Cafe Architect', system_prompt: 'You design viral, cozy, aesthetic coffee shops. Focus on interior vibes, customer flow, seating layout, and Instagrammable lighting.', model: 'mistral-small-latest', temperature: 0.8 },
      { id: 'coffee_growth_lead', display_name: 'Franchise Growth Strategist', system_prompt: 'You build global coffee brand chains. Analyze daily foot traffic, subscription coffee boxes, drive-thru speed, and profit margins.', model: 'mistral-small-latest', temperature: 0.6 }
    ];
  }

  if (lower.includes('game') || lower.includes('gaming') || lower.includes('esports')) {
    return [
      { id: 'lead_game_designer', display_name: 'Lead Game Systems Designer', system_prompt: 'You design AAA games. Evaluate ideas for core gameplay loops, player progression, mechanics, balancing, and replayability.', model: 'mistral-large-latest', temperature: 0.8 },
      { id: 'esports_champion', display_name: 'Pro Esports Champion', system_prompt: 'You are a top competitive gamer. Analyze frame data, skill ceiling, spectator hype, competitive meta, and tournament appeal.', model: 'open-mixtral-8x22b', temperature: 0.9 },
      { id: 'monetization_expert', display_name: 'Live-Service Producer', system_prompt: 'You run live-service games. Focus on battle passes, seasonal events, cosmetic skins, and long-term player retention.', model: 'mistral-small-latest', temperature: 0.6 }
    ];
  }

  // Dynamic topic-tailored fallback
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 12);
  const topicKey = sanitize(cleanedTopic) || 'custom_topic';
  const topicShort = cleanedTopic.length > 25 ? cleanedTopic.slice(0, 25) + '...' : cleanedTopic;

  return [
    {
      id: `${topicKey}_strategist`,
      display_name: `Lead Strategist (${topicShort})`,
      system_prompt: `You are the lead domain strategist specializing in "${cleanedTopic}". Analyze high-level strategy, market positioning, competitive advantage, and execution roadmaps for "${cleanedTopic}".`,
      model: 'mistral-large-latest',
      temperature: 0.7
    },
    {
      id: `${topicKey}_innovator`,
      display_name: `Creative Visionary (${topicShort})`,
      system_prompt: `You are an imaginative innovator focusing on "${cleanedTopic}". Challenge standard approaches, propose viral features, and bring bold artistic concepts to "${cleanedTopic}".`,
      model: 'open-mixtral-8x22b',
      temperature: 0.9
    },
    {
      id: `${topicKey}_auditor`,
      display_name: `Pragmatic Auditor (${topicShort})`,
      system_prompt: `You are a critical auditor scrutinizing "${cleanedTopic}". Identify operational risks, cost bottlenecks, user friction points, and key metrics to ensure long-term success for "${cleanedTopic}".`,
      model: 'mistral-small-latest',
      temperature: 0.6
    }
  ];
}

app.post('/api/generate-roles', async (req, res) => {
  const { scene } = req.body;
  if (!scene) return res.status(400).json({ error: 'Scene is required' });

  try {
    const ai = getOpenAI();
    const completion = await ai.chat.completions.create({
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'system',
          content: `You are an expert character creator and brainstorm panel director. Given a topic, scenario, or concept provided by the user, generate 3 to 4 highly relevant, distinct, creative, and engaging personas/characters specifically tailored to discuss "${scene}".

Return ONLY a valid JSON object with a "roles" array. Each item in "roles" must have:
- "id": lowercase string with underscores (e.g. "cafe_roaster" or "quantum_physicist")
- "display_name": catchy, descriptive character name (e.g. "Master Roaster Ansel")
- "system_prompt": detailed role instructions describing their perspective, expertise, and how they evaluate ideas regarding "${scene}".
- "model": one of "mistral-large-latest", "mistral-small-latest", or "open-mixtral-8x22b"
- "temperature": number between 0.6 and 0.9

Do NOT include markdown formatting or explanations. Output pure JSON.`
        },
        { role: 'user', content: `Generate 3 to 4 distinct discussion characters for topic: "${scene}"` }
      ]
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.roles && Array.isArray(parsed.roles) && parsed.roles.length > 0) {
        return res.json(parsed);
      }
    }
    throw new Error('Could not parse roles JSON from completion');
  } catch (err: any) {
    console.error('generate-roles error, using topic fallback:', err?.message || err);
    const fallbackRoles = generateFallbackRoles(scene);
    res.json({ roles: fallbackRoles });
  }
});

app.post('/api/rooms/:roomId/chat', async (req, res) => {
  const roomId = req.params.roomId;
  const { content, crossTalkLevel = 'medium', roster, customRoles, fastMode, isAutopilot, skipStream, threadName } = req.body;
  const room = rooms[roomId];

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (threadName) {
    room.niche = threadName;
  }
  if (roster && Array.isArray(roster)) {
    room.roster = roster;
  }
  if (customRoles) {
    room.customRoles = { ...room.customRoles, ...customRoles };
  }

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const emit = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ai = getOpenAI();
    let currentRound = 1;
    if (messages[roomId].length > 0) {
      currentRound = messages[roomId][messages[roomId].length - 1].roundNumber + 1;
    }

    // Add user message if not in automatic background autopilot
    if (content && !isAutopilot) {
      const userMsg: Message = {
        id: uuidv4(),
        roomId,
        speaker: 'user',
        content,
        roundNumber: currentRound,
        createdAt: Date.now()
      };
      messages[roomId].push(userMsg);
      emit('message', userMsg);
    }

    // Initial Roster Assembly if empty
    if (room.roster.length === 0) {
      // Very basic classification - just pick all for the prototype
      room.roster = ['strategist', 'skeptic', 'creative', 'executor', 'technical_architect', 'user_advocate'];
      emit('room_update', room);
      
      const introMsg: Message = {
        id: uuidv4(),
        roomId,
        speaker: 'system',
        content: `I've assembled a panel for this: ${room.roster.map(r => (ROLE_POLICY[r] || room.customRoles?.[r])?.display_name).join(', ')}.`,
        roundNumber: currentRound,
        createdAt: Date.now()
      };
      messages[roomId].push(introMsg);
      emit('message', introMsg);
    }

    // Determine who speaks based on cross-talk level
    let speakerCount = 4;
    if (crossTalkLevel === 'low') speakerCount = Math.min(2, room.roster.length);
    else if (crossTalkLevel === 'high') speakerCount = room.roster.length;
    else speakerCount = Math.min(4, room.roster.length); // medium

    const shuffled = [...room.roster].sort(() => 0.5 - Math.random());
    const speakers = shuffled.slice(0, speakerCount);

    for (const roleId of speakers) {
      const role = ROLE_POLICY[roleId] || room.customRoles?.[roleId];
      if (!role) continue;

      emit('agent_start', { roleId, displayName: role.display_name });

      // Build context
      const chatTranscript = messages[roomId].map(m => {
        let name = m.speaker;
        if (m.speaker === 'user') name = 'User';
        else if (m.speaker === 'system') name = 'System';
        else name = (ROLE_POLICY[m.speaker] || room.customRoles?.[m.speaker])?.display_name || m.speaker;
        return `[${name}]: ${m.content}`;
      }).join('\n');

      let fullResponse = '';
      if (skipStream) {
        let retries = 3;
        while (retries > 0) {
          try {
            const completion = await ai.chat.completions.create({
              model: role.model,
              messages: [
                { role: 'system', content: `${role.system_prompt}\n\nHere is the transcript of the room so far. Respond in character. Do not prefix your response with your name, just give your reply.` },
                { role: 'user', content: chatTranscript }
              ],
              temperature: role.temperature,
              stream: false,
            });
            fullResponse = completion.choices[0]?.message?.content || '';
            break;
          } catch (err: any) {
            if (err.status === 429 && retries > 1) {
              retries--;
              await new Promise(res => setTimeout(res, 3000));
              continue;
            }
            throw err;
          }
        }
      } else {
        let stream;
        let retries = 3;
        while (retries > 0) {
          try {
            stream = await ai.chat.completions.create({
              model: role.model,
              messages: [
                { role: 'system', content: `${role.system_prompt}\n\nHere is the transcript of the room so far. Respond in character. Do not prefix your response with your name, just give your reply.` },
                { role: 'user', content: chatTranscript }
              ],
              temperature: role.temperature,
              stream: true,
            });
            break; // success
          } catch (err: any) {
            if (err.status === 429 && retries > 1) {
              retries--;
              await new Promise(res => setTimeout(res, 3000)); // wait 3s before retry
              continue;
            }
            throw err;
          }
        }

        if (stream) {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            fullResponse += text;
            emit('agent_chunk', { roleId, text });
          }
        }
      }

      const agentMsg: Message = {
        id: uuidv4(),
        roomId,
        speaker: roleId,
        content: fullResponse,
        roundNumber: currentRound,
        createdAt: Date.now()
      };
      messages[roomId].push(agentMsg);
      emit('agent_done', agentMsg);
      
      // Delay before the next agent speaks to respect free tier limits and add intentional delay
      await new Promise(resolve => setTimeout(resolve, fastMode ? 500 : 4000));
    }

    emit('done', {});
    res.end();
  } catch (err: any) {
    console.error(err);
    emit('error', { message: err.message });
    res.end();
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
