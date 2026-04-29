-- Notebook 数据库初始化脚本

-- 1. 扩展
CREATE EXTENSION IF NOT EXISTS moddatetime;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 条目表
CREATE TABLE notebook_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author text NOT NULL CHECK (author IN ('ai', 'user')),
  content text NOT NULL CHECK (octet_length(content) <= 10240),
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. 排序索引
CREATE INDEX idx_notebook_entries_sort ON notebook_entries (pinned DESC, created_at DESC);

-- 4. updated_at 自动维护
CREATE TRIGGER notebook_entries_updated_at
  BEFORE UPDATE ON notebook_entries
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- 5. 禁止修改 author 字段
CREATE OR REPLACE FUNCTION prevent_author_change() RETURNS trigger AS $$
BEGIN
  IF NEW.author <> OLD.author THEN
    RAISE EXCEPTION 'author field is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notebook_entries_author_immutable
  BEFORE UPDATE ON notebook_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_author_change();

-- 6. RLS
ALTER TABLE notebook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_entries FOR ALL USING (true) WITH CHECK (true);

-- 7. 批注表
CREATE TABLE notebook_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id bigint NOT NULL REFERENCES notebook_entries(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('ai', 'user')),
  content text NOT NULL CHECK (octet_length(content) <= 10240),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notebook_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_annotations FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_notebook_annotations_entry ON notebook_annotations (entry_id);

-- 8. 批注不可变：禁止 UPDATE 和非级联 DELETE
CREATE OR REPLACE FUNCTION prevent_annotation_modify() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'annotations are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notebook_annotations_no_update
  BEFORE UPDATE ON notebook_annotations
  FOR EACH ROW EXECUTE FUNCTION prevent_annotation_modify();

CREATE TRIGGER notebook_annotations_no_delete
  BEFORE DELETE ON notebook_annotations
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION prevent_annotation_modify();

-- 9. 设置表（单行）
CREATE TABLE notebook_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ai_name text DEFAULT 'Lori' CHECK (char_length(ai_name) <= 256),
  user_name text DEFAULT '猫猫' CHECK (char_length(user_name) <= 256),
  ai_icon text DEFAULT '' CHECK (char_length(ai_icon) <= 32),
  user_icon text DEFAULT '' CHECK (char_length(user_icon) <= 32)
);

INSERT INTO notebook_settings (id) VALUES (1);

ALTER TABLE notebook_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_settings FOR ALL USING (true) WITH CHECK (true);
