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
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY environment variable is required');
    }
    openai = new OpenAI({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: process.env.MISTRAL_API_KEY,
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

// Role Policy config
export const ROLE_POLICY: Record<string, { display_name: string, model: string, system_prompt: string, temperature: number }> = {
  strategist: {
    display_name: 'The Strategist',
    model: 'mistral-large-latest',
    system_prompt: 'You are a visionary Strategist in a group ideation chat. Focus on the big picture, long-term horizons, and core value proposition. Be concise.',
    temperature: 0.6,
  },
  skeptic: {
    display_name: 'The Skeptical CFO',
    model: 'mistral-small-latest',
    system_prompt: 'You are a numbers-first, skeptical CFO persona in a group ideation chat. Challenge assumptions, ask about unit economics, risk, and feasibility. Be terse and direct.',
    temperature: 0.4,
  },
  executor: {
    display_name: 'The Executor',
    model: 'open-mistral-nemo',
    system_prompt: 'You are an Executor / Project Manager. You turn abstract ideas into concrete, actionable steps. Keep it structured and pragmatic.',
    temperature: 0.5,
  },
  creative: {
    display_name: 'The Creative',
    model: 'open-mixtral-8x22b',
    system_prompt: 'You are a Creative Director / Copywriter. Focus on storytelling, stylistic flavor, and emotional resonance. Speak with flair.',
    temperature: 0.8,
  },
  technical_architect: {
    display_name: 'The Tech Architect',
    model: 'codestral-latest',
    system_prompt: 'You are a Technical Architect in a group ideation chat. Focus on system design, scalability, technical feasibility, and technology choices. Be analytical and pragmatic.',
    temperature: 0.5,
  },
  user_advocate: {
    display_name: 'The User Advocate',
    model: 'mistral-large-latest',
    system_prompt: 'You are the User Advocate in a group ideation chat. You prioritize the user experience, accessibility, and solving real user pain points. Be empathetic and focus on human needs.',
    temperature: 0.6,
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

app.post('/api/generate-roles', async (req, res) => {
  const { scene } = req.body;
  if (!scene) return res.status(400).json({ error: 'Scene is required' });

  try {
    const ai = getOpenAI();
    const completion = await ai.chat.completions.create({
      model: 'mistral-large-latest',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an AI that assigns roles for a group discussion. Given a scene description, output a JSON object with a "roles" array. Each role should have: "id" (lowercase, no spaces), "display_name", "system_prompt" (detailed instructions for the role), "model" (one of: mistral-large-latest, mistral-small-latest, open-mistral-nemo, open-mixtral-8x22b, codestral-latest), and "temperature" (0.0 to 1.0).'
        },
        { role: 'user', content: scene }
      ]
    });
    const result = JSON.parse(completion.choices[0].message.content || '{"roles": []}');
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate roles' });
  }
});

app.post('/api/rooms/:roomId/chat', async (req, res) => {
  const roomId = req.params.roomId;
  const { content, crossTalkLevel = 'medium', roster, customRoles, fastMode, isAutopilot, skipStream } = req.body;
  const room = rooms[roomId];

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
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
