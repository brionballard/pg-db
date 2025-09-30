CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "name" varchar NOT NULL,
  "email" varchar NOT NULL,
  "phone" varchar,
  "password" varchar NOT NULL,
  "last_modified_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_users_email
    ON "users" ("email");
