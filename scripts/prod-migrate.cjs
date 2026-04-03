const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

const migrations = [
  // ── seasons ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS seasons (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── daily_challenges ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_challenges (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL UNIQUE,
    word TEXT NOT NULL,
    letter TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── daily_challenge_entries ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_challenge_entries (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR NOT NULL,
    date TEXT NOT NULL,
    guesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed BOOLEAN NOT NULL DEFAULT false,
    won BOOLEAN NOT NULL DEFAULT false,
    guess_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP NOT NULL DEFAULT now(),
    finished_at TIMESTAMP,
    rank INTEGER
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS daily_challenge_entries_player_date_unique ON daily_challenge_entries(player_id, date)`,

  // ── daily_tasks (definitions) ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_tasks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    title_ar TEXT NOT NULL,
    desc_ar TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📋',
    target INTEGER NOT NULL,
    type TEXT NOT NULL,
    reward_coins INTEGER NOT NULL DEFAULT 0,
    reward_xp INTEGER NOT NULL DEFAULT 0
  )`,

  // ── achievements (definitions) ────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS achievements (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    title_ar TEXT NOT NULL,
    desc_ar TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '🏆',
    target INTEGER NOT NULL,
    type TEXT NOT NULL,
    reward_coins INTEGER NOT NULL DEFAULT 0,
    reward_xp INTEGER NOT NULL DEFAULT 0
  )`,

  // ── player_daily_tasks ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS player_daily_tasks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR NOT NULL,
    task_key TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    assigned_date TEXT NOT NULL,
    claimed_at TIMESTAMP,
    baseline_wins INTEGER NOT NULL DEFAULT 0,
    baseline_games INTEGER NOT NULL DEFAULT 0,
    baseline_score INTEGER NOT NULL DEFAULT 0
  )`,

  // ── player_achievements ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS player_achievements (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR NOT NULL,
    achievement_key TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    unlocked INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    unlocked_at TIMESTAMP,
    claimed_at TIMESTAMP
  )`,

  // ── battle_pass_tiers ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS battle_pass_tiers (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id VARCHAR NOT NULL,
    tier INTEGER NOT NULL,
    free_reward_type TEXT NOT NULL,
    free_reward_id TEXT,
    free_reward_amount INTEGER NOT NULL DEFAULT 0,
    premium_reward_type TEXT NOT NULL,
    premium_reward_id TEXT,
    premium_reward_amount INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS battle_pass_tiers_season_tier_unique ON battle_pass_tiers(season_id, tier)`,

  // ── player_battle_pass ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS player_battle_pass (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR NOT NULL,
    season_id VARCHAR NOT NULL,
    pass_xp INTEGER NOT NULL DEFAULT 0,
    current_tier INTEGER NOT NULL DEFAULT 0,
    premium_unlocked BOOLEAN NOT NULL DEFAULT false,
    claimed_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS player_battle_pass_player_season_unique ON player_battle_pass(player_id, season_id)`,

  // ── clans ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS clans (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '⚔️',
    leader_id VARCHAR NOT NULL,
    total_war_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── clan_members ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS clan_members (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    clan_id VARCHAR NOT NULL,
    player_id VARCHAR NOT NULL,
    war_score INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS clan_members_clan_player_unique ON clan_members(clan_id, player_id)`,

  // ── spectator_bets ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS spectator_bets (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR NOT NULL,
    spectator_id VARCHAR NOT NULL,
    bet_on_player_id VARCHAR NOT NULL,
    amount INTEGER NOT NULL,
    settled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── room_invites ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS room_invites (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    from_player_id VARCHAR NOT NULL,
    to_player_id VARCHAR NOT NULL,
    room_id VARCHAR NOT NULL,
    from_player_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── friends (new schema: player_id + friend_id) ───────────────────────────
  `CREATE TABLE IF NOT EXISTS friends (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR NOT NULL,
    friend_id VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── friend_requests ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS friend_requests (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id VARCHAR NOT NULL,
    receiver_id VARCHAR NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── coin_gifts ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS coin_gifts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    from_player_id VARCHAR NOT NULL,
    to_player_id VARCHAR NOT NULL,
    amount INTEGER NOT NULL,
    seen BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── player_profiles: add missing columns if not present ──────────────────
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'MA'`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS clan_id VARCHAR`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS elo INTEGER NOT NULL DEFAULT 1000`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'silver'`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS peak_elo INTEGER NOT NULL DEFAULT 1000`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS season_wins INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS season_losses INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS referral_code TEXT`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS referred_by TEXT`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMP`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS vip_subscription_id TEXT`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS last_login_date TEXT`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS longest_login_streak INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS player_code TEXT`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS player_tag INTEGER`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS equipped_title TEXT DEFAULT 'beginner'`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS owned_titles JSONB NOT NULL DEFAULT '["beginner"]'::jsonb`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS power_cards JSONB DEFAULT '{"time":3,"freeze":3,"hint":3}'::jsonb`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS best_streak INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS last_streak_reward INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS last_spin_at TIMESTAMP`,
  `ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS vip_subscription_id TEXT`,

  // ── win_streaks ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS win_streaks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR NOT NULL,
    streak_length INTEGER NOT NULL,
    bonus_awarded INTEGER NOT NULL DEFAULT 0,
    milestone INTEGER NOT NULL DEFAULT 0,
    awarded_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── daily_spins ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_spins (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id VARCHAR NOT NULL,
    reward_type TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    spun_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── tournaments ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tournaments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'open',
    entry_fee INTEGER NOT NULL DEFAULT 100,
    prize_pool INTEGER NOT NULL DEFAULT 0,
    max_players INTEGER NOT NULL DEFAULT 8,
    winner_id VARCHAR,
    winner_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
  )`,

  // ── tournament_players ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tournament_players (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id VARCHAR NOT NULL,
    player_id VARCHAR NOT NULL,
    player_name TEXT NOT NULL,
    player_skin TEXT NOT NULL DEFAULT 'student',
    seed INTEGER NOT NULL DEFAULT 0,
    eliminated INTEGER NOT NULL DEFAULT 0,
    placement INTEGER,
    joined_at TIMESTAMP NOT NULL DEFAULT now()
  )`,

  // ── tournament_matches ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tournament_matches (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id VARCHAR NOT NULL,
    round_name TEXT NOT NULL,
    match_index INTEGER NOT NULL,
    player1_id VARCHAR,
    player1_name TEXT,
    player2_id VARCHAR,
    player2_name TEXT,
    winner_id VARCHAR,
    winner_name TEXT,
    room_id VARCHAR,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    completed_at TIMESTAMP
  )`,
];

async function run() {
  await client.connect();
  console.log('Connected to production DB');

  let succeeded = 0;
  let failed = 0;

  for (const sql of migrations) {
    const preview = sql.trim().split('\n')[0].substring(0, 80);
    try {
      await client.query(sql);
      console.log(`✓ ${preview}`);
      succeeded++;
    } catch (err) {
      if (err.code === '42701' || err.code === '42P07' || err.code === '42710') {
        console.log(`- (already exists) ${preview}`);
        succeeded++;
      } else {
        console.error(`✗ FAILED: ${preview}`);
        console.error(`  Error (${err.code}): ${err.message}`);
        failed++;
      }
    }
  }

  await client.end();
  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
