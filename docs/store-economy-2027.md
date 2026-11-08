# Local store economy proposal applied

Client prices now use three rarity tiers. All existing free defaults, identities, inventory, equipment, and earned unlocks are preserved. No existing static character is relabelled as animated, and no new achievement criteria or item IDs are invented.

| Tier | Range | Examples |
| --- | --- | --- |
| Ordinary | 2000–5000 | Calligraphy nameplate 2000, mosaic frame 2500, traveler 3000, Marrakech background 4000, courier/starlight 5000 |
| Rare | 15000–30000 | Amazigh 15000, explorer 18000, shadow guardian 30000; frames/backgrounds/nameplates 15000–25000 |
| Legendary | 60000–100000 | Golden burst 60000, king 80000; upper range reserved for future premium assets |

Every paid item in the existing store has an explicit quote in constants/store-economy.ts. Future seasonal assets remain unavailable; their acquisition and final item pricing still require backend integration. Owned and achievement-earned cosmetics are not revoked or repriced retroactively.

The server's authoritative catalog remains unchanged because backend/Supabase changes are forbidden. Therefore new prices are visible in the client, but purchase controls and the actual purchase function fail closed for any changed price. Existing owned equipment and visual previews remain available. This is not a production price rollout and does not prevent old app versions buying at their old server prices. Activation needs a later synchronized authoritative catalog and matching client compatibility/quote validation.

Daily ad milestones remain independent 100/250/500/1000/1500/2000 payouts (5350 total); no live ad credit, match fee/reward or wallet rule was changed. Raising prices alone is a starting economy design and still needs real progression testing.
