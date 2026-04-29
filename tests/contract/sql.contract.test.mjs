import test from 'node:test';
import { assertContains, readRequired } from './helpers.mjs';

test('setup.sql defines entries with author enum and 10KB byte limit', () => {
  const sql = readRequired('supabase/setup.sql');
  assertContains(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?notebook_entries/i, 'notebook_entries table must be created');
  assertContains(sql, /author\s+text\s+NOT\s+NULL\s+CHECK\s*\(\s*author\s+IN\s*\(\s*'ai'\s*,\s*'user'\s*\)\s*\)/i, 'entries.author must be constrained to ai/user');
  assertContains(sql, /content\s+text\s+NOT\s+NULL\s+CHECK\s*\(\s*octet_length\s*\(\s*content\s*\)\s*<=\s*10240\s*\)/i, 'entries.content must have a DB 10KB byte limit');
});

test('setup.sql defines sorting index and updated_at trigger', () => {
  const sql = readRequired('supabase/setup.sql');
  assertContains(sql, /CREATE\s+INDEX[\s\S]+notebook_entries[\s\S]+pinned\s+DESC[\s\S]+created_at\s+DESC/i, 'entries sort index must cover pinned DESC, created_at DESC');
  assertContains(sql, /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+moddatetime/i, 'moddatetime extension must be enabled');
  assertContains(sql, /CREATE\s+TRIGGER\s+notebook_entries_updated_at[\s\S]+BEFORE\s+UPDATE\s+ON\s+notebook_entries[\s\S]+moddatetime\s*\(\s*updated_at\s*\)/i, 'updated_at trigger must use moddatetime(updated_at)');
});

test('setup.sql prevents entry author changes', () => {
  const sql = readRequired('supabase/setup.sql');
  assertContains(sql, /prevent_author_change/i, 'author immutability trigger function is required');
  assertContains(sql, /NEW\.author\s*<>\s*OLD\.author/i, 'author immutability function must compare NEW.author and OLD.author');
  assertContains(sql, /CREATE\s+TRIGGER\s+notebook_entries_author_immutable[\s\S]+BEFORE\s+UPDATE\s+ON\s+notebook_entries/i, 'author immutability trigger must run before entry updates');
});

test('setup.sql defines immutable annotations with cascade delete exception', () => {
  const sql = readRequired('supabase/setup.sql');
  assertContains(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?notebook_annotations/i, 'notebook_annotations table must be created');
  assertContains(sql, /REFERENCES\s+notebook_entries\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i, 'annotations must cascade when an entry is deleted');
  assertContains(sql, /content\s+text\s+NOT\s+NULL\s+CHECK\s*\(\s*octet_length\s*\(\s*content\s*\)\s*<=\s*10240\s*\)/i, 'annotations.content must have a DB 10KB byte limit');
  assertContains(sql, /CREATE\s+TRIGGER\s+notebook_annotations_no_update[\s\S]+BEFORE\s+UPDATE\s+ON\s+notebook_annotations/i, 'annotation updates must be blocked');
  assertContains(sql, /CREATE\s+TRIGGER\s+notebook_annotations_no_delete[\s\S]+BEFORE\s+DELETE\s+ON\s+notebook_annotations[\s\S]+pg_trigger_depth\s*\(\s*\)\s*=\s*0/i, 'direct annotation deletes must be blocked while cascade deletes are allowed');
});

test('setup.sql defines bounded single-row settings', () => {
  const sql = readRequired('supabase/setup.sql');
  assertContains(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?notebook_settings/i, 'notebook_settings table must be created');
  assertContains(sql, /id\s+int\s+PRIMARY\s+KEY\s+DEFAULT\s+1\s+CHECK\s*\(\s*id\s*=\s*1\s*\)/i, 'settings must be single-row id=1');
  assertContains(sql, /ai_name\s+text\s+DEFAULT\s+'Lori'\s+CHECK\s*\(\s*char_length\s*\(\s*ai_name\s*\)\s*<=\s*256\s*\)/i, 'ai_name must be length-limited');
  assertContains(sql, /user_name\s+text\s+DEFAULT\s+'猫猫'\s+CHECK\s*\(\s*char_length\s*\(\s*user_name\s*\)\s*<=\s*256\s*\)/i, 'user_name must be length-limited');
  assertContains(sql, /ai_icon\s+text\s+DEFAULT\s+''\s+CHECK\s*\(\s*char_length\s*\(\s*ai_icon\s*\)\s*<=\s*32\s*\)/i, 'ai_icon must be length-limited');
  assertContains(sql, /user_icon\s+text\s+DEFAULT\s+''\s+CHECK\s*\(\s*char_length\s*\(\s*user_icon\s*\)\s*<=\s*32\s*\)/i, 'user_icon must be length-limited');
  assertContains(sql, /INSERT\s+INTO\s+notebook_settings\s*\(\s*id\s*\)\s+VALUES\s*\(\s*1\s*\)/i, 'settings id=1 row must be inserted');
});

