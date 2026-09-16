# Migration from the single-file app

Mmry was one self-extracting `Mmry.html` (a Claude Design canvas bundle with
~2,150 lines of logic and 28 languages), an ONNX speech engine, a Node model
server and an Expo wrapper. It was migrated feature by feature into the
current stack, then removed.

## Where each feature went

| Original | Now |
| --- | --- |
| Home: greeting, clock, "right now" card, tiles, SOS | `components/dashboard/HomeScreen.tsx`, `lib/routine/now.ts` |
| My day (resets daily, localStorage) | `DayScreen.tsx`; `tasks` + `task_completions` keyed by the patient's local day |
| 8 games and adaptive level rule | `lib/games/engine.ts` (pure, unit-tested); level from the TensorFlow model clamped to the original rule |
| Talk companion, keyword intents, guided conversation | `TalkScreen.tsx`, `lib/assistant/conversation.ts`; intent from the scikit-learn classifier with the keyword rule as fallback |
| My people + memory vault | `PeopleScreen.tsx`, `people` table; the vault is now real, encrypted patient data (it was demo text) |
| Mind check (area scoring, "inconsistent" flag) | `CheckScreen.tsx`, `lib/check/steps.ts`; area scoring moved to `activity.service.ts` |
| Care: status, pillars, alerts, metrics, trend, insights, baseline, log, sync | `CareScreen.tsx` + `analytics/page.tsx`; rules in `utils/scoring.ts` and `insights.service.ts` |
| Location, safe zone, radar, SOS SMS/call, places, history | `SafetyPanel.tsx`, `safety.service.ts`; geofence decided server-side with the same hysteresis; coordinates encrypted |
| Profile, caregiver PIN (compared in the browser) | `ProfileForm.tsx`; PIN scrypt-hashed and verified by the API |
| Language and voice selection, stand-in script logic | `lib/speech/voices.ts`, `SettingsForm.tsx` |
| 28-language translation tables | `lib/i18n/locales/*.json`, loaded per language |
| "Sync now" (only flipped a flag) | a real offline queue: `useSessionQueue.ts`, idempotent `clientRef` replays |
| Fonts (Atkinson Hyperlegible Next, Material Symbols) | `public/fonts/`, self-hosted |
| Design tokens (cream, navy, green, 56-60 px targets) | `app/globals.css` and CSS modules, now fluid and responsive |

## Retired, and why

- **Offline ONNX speech (Whisper STT, MMS TTS) and language packs.** The target stack has no
  ONNX runtime, and the frontend may not load models. Speech now uses the browser's speech
  synthesis and recognition. This removes the original "fully offline" claim, and Chrome's
  recogniser sends audio to Google. The pack UI and its translations were removed rather than
  left promising something that no longer exists.
- **Expo mobile app.** It displayed `Mmry.html` in a WebView, so it could not outlive the file.
  The responsive web app now covers phones; a native shell would need rebuilding against the
  new frontend.
- **Strings that became untrue:** "Works offline", "Nothing is uploaded" (positions are now
  stored, encrypted), and the offline-model error explanations. They were replaced with
  accurate English text; other languages fall back to English for those keys.
- **Hard-coded demo data** in the memory vault (an invented address and phone numbers).

## Legacy backup

Nothing was deleted without a copy. The complete legacy project, including
`Mmry.html`, the Expo app, the ONNX engine, the 1.1 GB of verified models and the
pack tooling, was moved to `../Mmry-legacy-backup/` next to this repository. It is
outside the project and can be deleted once no longer needed.
