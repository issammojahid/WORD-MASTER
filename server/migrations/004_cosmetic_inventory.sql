-- Add player-owned cosmetic inventory without changing existing profile data.
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS owned_cosmetics jsonb NOT NULL
    DEFAULT '{"frame":["basic_frame"],"background":["basic_background"],"nameplate":["basic_nameplate"],"victory":["no_victory_effect"],"seasonal":["no_seasonal"]}'::jsonb,
  ADD COLUMN IF NOT EXISTS equipped_cosmetics jsonb NOT NULL
    DEFAULT '{"frame":"basic_frame","background":"basic_background","nameplate":"basic_nameplate","victory":"no_victory_effect","seasonal":"no_seasonal"}'::jsonb;
