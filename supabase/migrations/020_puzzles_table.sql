-- Puzzles table for Mickey's daily emoji riddles
CREATE TABLE public.puzzles (
  id SERIAL PRIMARY KEY,
  day_index INT NOT NULL UNIQUE,
  puzzle TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active puzzles
CREATE POLICY "Authenticated users can read puzzles"
  ON public.puzzles FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can do everything
CREATE POLICY "Admins can manage puzzles"
  ON public.puzzles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_puzzles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER puzzles_updated_at
  BEFORE UPDATE ON public.puzzles
  FOR EACH ROW EXECUTE FUNCTION update_puzzles_updated_at();

-- Seed data from mickeys-puzzles.json
INSERT INTO public.puzzles (day_index, puzzle, answer) VALUES
  (0, '🐶 + IT', 'Doggin It'),
  (1, '🚦 + ⚽🏀🏈', 'Go Balls Out'),
  (2, '👟 + T + 4 + THE + ⭐', 'Shoot For The Stars'),
  (3, '⭕ + / + 🐄', 'Stop Having A Cow'),
  (4, '🎧 + ⬆️', 'Listen Up'),
  (5, '🙅 + 🍺 + 🚗', 'Don''t Drink And Drive'),
  (6, '👀 + ⬆️ + ⏰', 'Look Up Time'),
  (7, '🔌 + N + ▶️', 'Plug And Play'),
  (8, '🐓 + 🚫', 'Don''t Chicken Out'),
  (9, '👊 + OR + ✈️', 'Fight Or Flight'),
  (10, '🚫 + 🔥 + 👤', 'Don''t Be Hot Headed'),
  (11, '👍 + 👍 + ⬆️', 'Two Thumbs Up'),
  (12, '😴 + ON + IT', 'Sleep On It'),
  (13, 'B + @ + R + ⬆️', 'Batter Up'),
  (14, '🔩 + ⬆️', 'Screw Up'),
  (15, 'H + 🍎 + E + ⚾', 'Have A Pitcher'),
  (16, '⬅️ + 2 + 👨 + 📦', 'One Way To Find Out'),
  (17, '⏰ + 👤 + L', 'Watch Me Later'),
  (18, '🐶 + 🏃', 'Dog Run'),
  (19, '🦁 + 👑', 'Lion King'),
  (20, '🎉 + ⬆️', 'Party Up'),
  (21, '🌈 + ⬆️', 'Rainbow Up'),
  (22, '🎸 + ⬆️', 'Guitar Up'),
  (23, '🍎 + 👁️ + 🍎', 'Apple Eye Apple'),
  (24, '⏰ + ✈️', 'Time Flies'),
  (25, '🦶 + 🪣', 'Kick The Bucket'),
  (26, '❄️ + 👤', 'Cold Shoulder'),
  (27, '💔 + A + 🦵', 'Break A Leg'),
  (28, '🥊 + ⭕ + 🌿', 'Beat Around The Bush'),
  (29, '🐝 + 4️⃣ + U', 'Be For You'),
  (30, '🧠 + ⬆️', 'Brain Up'),
  (31, '🐍 + 👀', 'Snake Eyes'),
  (32, '🌙 + ⬆️', 'Shoot The Moon'),
  (33, '🏃 + 4 + IT', 'Go For It'),
  (34, '🎯 + IT', 'Hit It'),
  (35, '🤞 + 🤞', 'Cross Your Fingers'),
  (36, '👂 + 🌽', 'Ear Of Corn'),
  (37, '🚶 + A + ⛰️', 'Take A Hike'),
  (38, '🐟 + 🌊', 'Fish Wave'),
  (39, '🌞 + ⬆️', 'Sun Up'),
  (40, '🐱 + 🐾', 'Cat Walk'),
  (41, '🔔 + 🔔 + 🔔', 'Ring Ring Ring'),
  (42, '💡 + ⬇️', 'Light Down'),
  (43, '🎤 + ⬆️', 'Speak Up'),
  (44, '🤝 + TH + ⬇️', 'Shake Things Down'),
  (45, '🌊 + ⬅️', 'Wave Left'),
  (46, '🏆 + THIS', 'Win This'),
  (47, '🐝 + 🏃', 'Bee Running'),
  (48, '💃 + ⭕', 'Dance Around'),
  (49, '🍔 + 👑', 'Burger King'),
  (50, '👕 + ⬆️', 'Shirt Up'),
  (51, '🎵 + ON', 'Music On'),
  (52, '🐴 + ¢ + UL', 'Horse Sense'),
  (53, '🍑 + SHAKE', 'Peach Shake'),
  (54, '🙆 + 🎧 + ME + ⭕', 'She Spins Me Around'),
  (55, '🍁 + S + 👂 + ⬆️', 'Maple Syrup'),
  (56, '⭕ + / + B + 🐝', 'Stop Being'),
  (57, '🐮 + ⭕', 'Go Around'),
  (58, '🚗 + ⬆️', 'Drive Up'),
  (59, '😂 + ⬇️', 'Laugh It Down'),
  (60, '👑 + ⚽', 'King Ball'),
  (61, '⭐ + ✨', 'Star Shine'),
  (62, '🏡 + ⬇️', 'House Down'),
  (63, '🎸 + ⬆️ + 🎸', 'Rock And Roll')
ON CONFLICT (day_index) DO NOTHING;
