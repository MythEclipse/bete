# Web Mic Noise Suppression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce background noise from the browser microphone before audio is sent to Discord.

**Architecture:** Use native browser audio constraints for echo cancellation, noise suppression, and auto gain control at `getUserMedia` capture time. Add a lightweight RMS noise gate inside the existing `onaudioprocess` transmit loop so quiet background noise becomes silence before PCM is sent over WebSocket.

**Tech Stack:** Browser MediaDevices API, Web Audio API, plain JavaScript in `public/index.html`, existing Bun/TypeScript verification scripts.

---

## File Structure

- Modify `public/index.html`: update mic capture constraints and add local RMS noise gate constants/helpers inside the existing script.
- No new dependencies.
- No server changes required.

---

### Task 1: Enable Browser-Level Audio Processing

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Update microphone constraints**

Replace:

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

With:

```js
const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
    },
});
```

- [ ] **Step 2: Run lint**

Run:

```bash
bun run lint
```

Expected: exits `0`.

---

### Task 2: Add Lightweight RMS Noise Gate

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add threshold constants near audio constants**

Add after:

```js
const CHANNELS = 1;
```

This code:

```js
const NOISE_GATE_THRESHOLD = 0.01;
const NOISE_GATE_HOLD_FRAMES = 3;
let noiseGateHold = 0;
```

- [ ] **Step 2: Add RMS helper function before `startStreaming()`**

Add before:

```js
async function startStreaming() {
```

This function:

```js
function calculateRms(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
}
```

- [ ] **Step 3: Apply gate before PCM conversion**

Replace:

```js
const inputData = e.inputBuffer.getChannelData(0);
const pcmData = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
    pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
}
socket.send(pcmData.buffer);
```

With:

```js
const inputData = e.inputBuffer.getChannelData(0);
const rms = calculateRms(inputData);
if (rms >= NOISE_GATE_THRESHOLD) {
    noiseGateHold = NOISE_GATE_HOLD_FRAMES;
} else if (noiseGateHold > 0) {
    noiseGateHold--;
}

const pcmData = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
    const sample = noiseGateHold > 0 ? inputData[i] : 0;
    pcmData[i] = Math.max(-1, Math.min(1, sample)) * 32767;
}
socket.send(pcmData.buffer);
```

- [ ] **Step 4: Reset gate on stop**

Add inside `stopStreaming()` after:

```js
isStreaming = false;
```

This line:

```js
noiseGateHold = 0;
```

- [ ] **Step 5: Run verification**

Run:

```bash
bun run test && bun run typecheck && bun run lint && bun run build
```

Expected: all commands exit `0`.

---

## Self-Review

- Spec coverage: Browser native noise suppression and JS noise gate are both covered.
- Placeholder scan: No placeholders or TODOs.
- Type consistency: Uses existing `SAMPLE_RATE`, `CHANNELS`, and `onaudioprocess` pipeline.
