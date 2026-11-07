-- PREPARED ONLY. Production application requires explicit approval.
-- Keeps the oldest profile's name; suffixes later duplicates without changing IDs/progress.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.player_profiles IN SHARE ROW EXCLUSIVE MODE;
WITH ranked AS (
 SELECT id,name,row_number() OVER (
  PARTITION BY lower(btrim(regexp_replace(normalize(name,NFKC), '[[:space:]]+', ' ', 'g')))
  ORDER BY created_at,id
 ) AS position FROM public.player_profiles
)
UPDATE public.player_profiles AS profiles
SET name=left(regexp_replace(btrim(normalize(ranked.name,NFKC)), '[[:space:]]+', ' ', 'g'),9)||'_'||substr(md5(ranked.id),1,10),updated_at=now()
FROM ranked WHERE profiles.id=ranked.id AND ranked.position>1;
-- Any unexpected suffix collision aborts the transaction, preserving all original data.
CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_name_key_unique
 ON public.player_profiles ((lower(btrim(regexp_replace(normalize(name,NFKC), '[[:space:]]+', ' ', 'g')))));
COMMIT;
