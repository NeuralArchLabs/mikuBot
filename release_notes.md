# 🌟 mikuBot v2.4.1 — Agent Autonomy & Remote Polish

We are proud to announce the release of **mikuBot v2.4.1**, a stability and autonomy update that refines the agent's workflow and ensures a seamless remote control experience.

## 🚀 Key Highlights

### 🤖 Stabilized Agent Console Autonomy
Miku's execution engine is now smarter about what requires your permission.
- **Enhanced Whitelists**: Essential diagnostic tools (`wmic`, `pnpm`, `yarn`) and safe network requests (`curl`, `wget` for research) are now fully whitelisted in Chat Mode.
- **Chained Commands**: The authorization engine now correctly parses and allows non-destructive chained commands without triggering unnecessary security roadblocks.

### 📱 Premium Telegram Integration
Controlling Miku remotely is now more reliable and informative.
- **Dynamic Tool Descriptions**: Approval requests sent to Telegram now include rich, detailed context (e.g., exact console commands or target file paths) instead of generic tool names.
- **Stale Closure Fix**: Resolved a critical bug where Telegram approval buttons (`Accept`/`Deny`) would freeze or lose connection to the active session.

### ✨ Visual Formatting & UI Polish
- **Markdown Integrity**: Fixed rendering bugs where text enclosed in `**` would fail to bold if it spanned multiple lines, both in standard chat and Telegram remote output.
- **Narrative Flow**: Agent narrative blocks within the collapsible tool execution loop now render with proper padding and clean markdown formatting, distinguishing them clearly from internal reasoning blocks.

## 🛠️ Technical Improvements
- **Electron Builder**: Resolved file system permission issues causing `7-Zip` symbolic link creation to fail during Windows compilation.
- **Engine Stability**: Patched `ENOTEMPTY` errors when clearing legacy virtual environments to prevent boot failures.

## ⬇️ Download
[Download MikuCentral-Setup-2.4.1.exe](https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.4.1/MikuCentral-Setup-2.4.1.exe)

---
*Developed with precision by Neural Arch Labs.*
