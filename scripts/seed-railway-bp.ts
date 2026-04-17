import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import { seasons, battlePassTiers } from "../shared/schema.js";

const url = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("RAILWAY_DATABASE_URL not set");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const db = drizzle(pool);

const BP_TIER_DEFS = [
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 50,   premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 100  },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 1,    premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 150  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 75,   premiumRewardType: "skin",      premiumRewardId: "djellaba",    premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 100,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 200  },
  { freeRewardType: "powerCard", freeRewardId: "freeze",      freeRewardAmount: 1,    premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 250  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 100,  premiumRewardType: "powerCard", premiumRewardId: "time",        premiumRewardAmount: 2    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 125,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 300  },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 2,    premiumRewardType: "skin",      premiumRewardId: "sport",       premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 150,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 350  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 150,  premiumRewardType: "title",     premiumRewardId: "eloquent",    premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 200,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 400  },
  { freeRewardType: "powerCard", freeRewardId: "freeze",      freeRewardAmount: 2,    premiumRewardType: "powerCard", premiumRewardId: "hint",        premiumRewardAmount: 3    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 200,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 450  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 225,  premiumRewardType: "skin",      premiumRewardId: "kaftan",      premiumRewardAmount: 0    },
  { freeRewardType: "powerCard", freeRewardId: "time",        freeRewardAmount: 2,    premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 500  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 250,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 550  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 250,  premiumRewardType: "powerCard", premiumRewardId: "freeze",      premiumRewardAmount: 3    },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 3,    premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 600  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 300,  premiumRewardType: "skin",      premiumRewardId: "ninja",       premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 300,  premiumRewardType: "title",     premiumRewardId: "lightning",   premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 350,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 700  },
  { freeRewardType: "powerCard", freeRewardId: "time",        freeRewardAmount: 3,    premiumRewardType: "powerCard", premiumRewardId: "time",        premiumRewardAmount: 3    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 400,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 750  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 400,  premiumRewardType: "skin",      premiumRewardId: "sahrawi",     premiumRewardAmount: 0    },
  { freeRewardType: "powerCard", freeRewardId: "freeze",      freeRewardAmount: 3,    premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 800  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 450,  premiumRewardType: "title",     premiumRewardId: "word_master", premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 500,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 900  },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 3,    premiumRewardType: "skin",      premiumRewardId: "hacker",      premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 500,  premiumRewardType: "coins",     premiumRewardId: null,          premiumRewardAmount: 1000 },
  { freeRewardType: "skin",      freeRewardId: "champion",    freeRewardAmount: 0,    premiumRewardType: "title",     premiumRewardId: "letter_king", premiumRewardAmount: 0    },
];

async function ensureActiveSeason() {
  const [active] = await db.select().from(seasons).where(eq(seasons.status, "active")).limit(1);
  if (active) return active;

  // Create-if-missing: 30-day season starting today
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const monthLabel = now.toLocaleDateString("ar", { month: "long", year: "numeric" });
  const name = `موسم ${monthLabel}`;
  const [created] = await db.insert(seasons).values({
    name,
    status: "active",
    startDate: now,
    endDate: end,
  } as typeof seasons.$inferInsert).returning();
  console.log(`✓ Created new active season: ${created.name} (${created.id})`);
  return created;
}

async function main() {
  const active = await ensureActiveSeason();
  console.log(`Active season: ${active.name} (${active.id})`);

  const existing = await db.select({ id: battlePassTiers.id }).from(battlePassTiers).where(eq(battlePassTiers.seasonId, active.id));
  console.log(`Existing tiers for this season: ${existing.length}`);
  if (existing.length === 30) {
    console.log("Already fully seeded. Exiting.");
    await pool.end();
    return;
  }
  if (existing.length > 0 && existing.length < 30) {
    console.log("Partial seed detected — wiping and re-seeding.");
    await db.delete(battlePassTiers).where(eq(battlePassTiers.seasonId, active.id));
  }

  const rows = BP_TIER_DEFS.map((def, i) => ({ seasonId: active.id, tier: i + 1, ...def }));
  await db.insert(battlePassTiers).values(rows);
  console.log(`✓ Seeded 30 tiers for season ${active.name}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
