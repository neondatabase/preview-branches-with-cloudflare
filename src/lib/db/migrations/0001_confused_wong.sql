-- Seed minimal sample data so a fresh preview branch returns something
-- meaningful from the demo query in src/index.ts.
INSERT INTO "authors" ("name") VALUES
  ('J.R.R. Tolkien'),
  ('George R.R. Martin'),
  ('Ursula K. Le Guin');
