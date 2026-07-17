# AI Agent Brainstorming & Discussion Room

An advanced, highly interactive full-stack web application designed for simulating collaborative multi-agent discussion and brainstorming sessions. Users can converse with an customized roster of AI specialist personas, adjust interaction dynamics in real-time, toggle background automation, and stream collaborative responses instantly.

---

## 🎨 Design & Visual Identity

The interface is built using a modern **Cosmic Slate Theme** and responsive typography:
- **Elegant & Focused UI**: Generous negative space, clean borders, high-contrast states, and micro-interactions optimized for seamless reading and navigation.
- **Custom Adaptive Pairings**: Pairing clean "Inter" and "Space Grotesk" typography with monospace accents to maximize readability.
- **Micro-Animations**: Framer Motion layouts and responsive entry transitions create an organic, native feel.

---

## 🚀 Key Features

### 👥 Persona & Roster Configuration
- **Custom Roster Assembly**: Define specialist agents (e.g., Strategist, Skeptic, Creative, Technical Architect, Executor, User Advocate) to participate in discussions.
- **Automatic Persona Generator**: Input custom scene descriptions or meeting objectives to automatically generate a tailored roster of AI specialists.
- **Dynamic Cross-Talk Adjustments**: Tune agent interaction patterns dynamically using **Low, Medium, or High cross-talk levels** to regulate spontaneity.

### ⚡ Smart Controls & Execution Modes
- **Autopilot Mode**: Let agents carry on discussions back-and-forth automatically, building sequentially on each other's brainstorming notes without requiring constant manual prompts.
- **Fast Mode**: Reduces inter-agent conversational delay, allowing high-throughput collaborative processing.
- **Instant Text (Skip Stream)**: Bypasses incremental typing streams, requesting and showing fully constructed AI responses instantaneously.
- **Stream Interrupt & Control (Cancel Stream)**: An interactive active-cancellation engine that allows users to instantly interrupt ongoing stream operations or stop the Autopilot process.
- **Quick-Start & Skip-to-Text**: Jump straight to brainstorming by bypassing complex configuration models, instantly starting discussions using optimized default agents.
- **Exit & Reset Room**: Fully clear and refresh existing sessions, resetting agent rosters, message boards, and scene scopes back to default parameters.

---

## 🛠️ Technical Architecture

### Front-End (Client SPA)
- **Vite & React (TypeScript)**: Extreme hot-reloading speeds and bulletproof type-safety.
- **Tailwind CSS**: Modern utility styling supporting beautiful light themes, flexible bento grids, and fluid layouts.
- **Server-Sent Event / Chunking Streams**: Custom streaming interface parsing chunks in real-time.

### Back-End (Server)
- **Express custom server (`server.ts`)**: Built with robust TS type-stripping, serving as a secure proxy layer hiding API secrets.
- **Direct Streaming API**: Custom pipelines managing sequential token emissions, with reliable retry routines for rate limits (HTTP 429) to ensure uninterrupted collaboration.

---

## 💾 Project Installation & Run Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root containing your Gemini API key (this is securely kept server-side):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server
Spins up the Express full-stack server on port `3000` with native Vite asset-serving middleware in parallel.
```bash
npm run dev
```

### 4. Build and Package for Production
Bundles client-side assets to `dist/` and compiles the backend into a fully self-contained CommonJS target (`dist/server.cjs`) using `esbuild`.
```bash
npm run build
```

### 5. Production Run
Launches the high-performance compiled server:
```bash
npm start
```

---

## 🚀 Deployment Status

The application compiles flawlessly and has passed all local linter rules (`tsc --noEmit`). It is 100% production-ready and fully primed for immediate container or cloud server deployment!
