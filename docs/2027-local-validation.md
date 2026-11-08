# Local interface follow-up

Completed without changing server code or Supabase:

- Added a six-topic Arabic playing guide in Settings: answers and keyboard navigation, modes, appearance ownership, friend rooms, connection problems and accessibility.
- Applied the local text-size preference to answer inputs, in addition to their labels.
- Modal transitions now respect reduced motion.
- Chest opening stops when the app leaves the foreground, settles without motion when reduced motion is enabled, and supports replay from its preview dialog. No reward is awarded.
- Gift cards expose one accessible button per card rather than reading both faces. Removed their nested scroll container; the shared modal provides scrolling.

Validation: TypeScript and focused ESLint pass. Four focused tests pass, including chest foreground/background and reduced-motion cleanup, gift selection gating, seasonal motion cleanup and text-size persistence. Browser verification confirmed the expandable guide and chest replay/close flow at localhost:8084. Screenshots are in the Codex workspace under previews/royal/help.jpg and chest.jpg.

Not represented as completed: real-phone microphone/keyboard/native ads tests, production reward granting, leaderboard results, final privacy/terms documents, or fully animated seasonal character assets. Those need actual device access, confirmed product/legal details, or the separately authorized backend phase. Existing preview artwork remains static art with UI animation.
