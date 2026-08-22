# 🌟 mikuBot v2.5.0 — Deep Research & Multimodal Experience Release

We are proud to announce **mikuBot v2.5.0**, a major release focused on autonomous research, multimodal workflows, a more expressive chat experience, and a clearer visual system across the desktop application.

## 🚀 Key Highlights

### 🔎 Deep Research with Recovery and Export
The research workflow now presents an explicit plan before execution and runs through planning, execution, verification, and synthesis stages.
- **Live investigation panel** with progress, activity, reflections, and validated source tracking.
- **Persistent checkpoints** allow interrupted investigations to resume from the latest validated state.
- **Plan adjustment** lets users provide feedback before restarting the research run.
- **Report export** saves the final Markdown report and can generate a PDF directly from the application.

### 🖼️ Multimodal Skills
- **Image generation** is available through the new `image_generator` skill with configurable model and aspect-ratio options.
- **Video captions** are retrieved through `video_transcriber` when available on YouTube; it does not download audio or perform local transcription.
- Model capability detection now helps route vision and multimodal work to compatible providers.

### 💬 Renewed Chat Experience
- A new welcome surface provides contextual suggestions across learning, research, planning, organization, widgets, scheduling, and conversation.
- Suggestions can populate the composer, replace a prompt suffix, or send immediately as a real chat message.
- Progressive typewriter effects and the neural signature now provide a more coherent entrance sequence without losing the active input flow.
- Streaming and tool/narrative rendering were refined for better continuity during long responses.

### 🧰 Unified Editing Workspace
Cortex and Commands now share a single editor workspace with a clear scope switch while preserving their original save, delete, and file-management behavior.

### 🎨 Theme and Contrast Refinements
- The public theme names are now **Synthwave** and **Emerald** instead of the previous project IDs `cyberpunk` and `forest`.
- Existing configurations using the legacy IDs are normalized automatically to avoid breaking saved preferences.
- Cloud, Synthwave, and Emerald received targeted refinements for chat surfaces, assistant bubbles, dropdown controls, action buttons, and inline code readability.

### 🔊 Voice Pipeline Improvements
The TTS flow now uses intelligent chunk planning and safer phonetic handling for technical vocabulary, with focused tests for chunk boundaries and synthesis behavior.

## 🧪 Validation

- TypeScript typecheck passes with `npm run typecheck`.
- Production bundle passes with `npm run build`.
- TTS chunk behavior is covered by `npm run test:tts-chunks`.

## ⬇️ Download

[Download MikuCentral.Setup.2.5.0.exe](https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.5.0/MikuCentral.Setup.2.5.0.exe)

---
*Developed with precision by Neural Arch Labs.*
