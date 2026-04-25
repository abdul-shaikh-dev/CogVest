# CogVest — Agent Instructions

## Project
CogVest is an Android-first React Native portfolio tracker with 
behavioural investing insights and Minimal Mode.

## Stack
- React Native + Expo SDK 52+
- TypeScript only. No JavaScript.
- Expo Router (file-based navigation)
- MMKV for persistence
- Zustand for state management
- React Native Reanimated for animations
- Victory Native for charts
- React Hook Form + Zod for forms

## Rules
- Functional components with hooks only. No class components.
- Persist raw data, derive everything else.
- All amounts in INR (Indian Rupees ₹).
- Behaviour fields (conviction, intended hold) are always optional.
- Minimal Mode is a display preference — never removes core functionality.
- No backend. No auth. No cloud. Local device storage only.
- All domain calculations must be pure functions in src/domain/.
- No business logic in components.

## Design
- Material Design 3 influenced
- Dark background: #1C1B1F
- Primary green: #2E7D52
- Standard Mode: full information density, red/green P&L cues
- Minimal Mode: calmer palette, reduced noise, long-term framing

## References
- Full spec: docs/cogvest-master-spec.md
- Mockups: docs/cogvest_standard_mode.png, docs/cogvest_minimal_mode.png
