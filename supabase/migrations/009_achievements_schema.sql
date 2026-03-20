-- ============================================================
-- Achievements system: achievements + user_achievements tables
-- ============================================================

-- Reference table: all available achievements
CREATE TABLE public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  category_emoji TEXT NOT NULL,
  target_count INT,                  -- null for one-time unlocks
  sort_order INT NOT NULL DEFAULT 0  -- display order within category
);

-- Allow anyone authenticated to read achievement definitions
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

-- Per-user progress tracking
CREATE TABLE public.user_achievements (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  progress INT NOT NULL DEFAULT 0,
  progress_detail JSONB,          -- e.g. {"red":[1,3,5],"white":[2,6]} for Punch Card
  completed_at TIMESTAMPTZ,       -- null = in progress, set = earned
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_completed
  ON user_achievements(user_id, completed_at)
  WHERE completed_at IS NOT NULL;

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read their own achievements
CREATE POLICY "Users can view own user_achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can view completed achievements (for leaderboard flair)
CREATE POLICY "Anyone can view completed user_achievements"
  ON user_achievements FOR SELECT
  USING (completed_at IS NOT NULL);

-- Service role (API route) manages all writes
CREATE POLICY "Service role manages user_achievements"
  ON user_achievements FOR ALL
  USING (auth.role() = 'service_role');
