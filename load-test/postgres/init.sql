-- Pre-create the drizzle migrations schema so the app doesn't need to
CREATE SCHEMA IF NOT EXISTS drizzle;
GRANT ALL PRIVILEGES ON SCHEMA drizzle TO skillarena;
GRANT ALL PRIVILEGES ON SCHEMA public TO skillarena;
