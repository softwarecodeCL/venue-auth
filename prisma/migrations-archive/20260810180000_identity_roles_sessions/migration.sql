-- Auth owns changes to the public identity schema.
CREATE TYPE "public"."ProfileMode" AS ENUM ('GUEST', 'HOST');

ALTER TABLE "public"."User"
ADD COLUMN "activeMode" "public"."ProfileMode" NOT NULL DEFAULT 'GUEST',
ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

-- Existing named users should not be forced through the new profile step.
UPDATE "public"."User"
SET "profileCompletedAt" = COALESCE("profileCompletedAt", "createdAt")
WHERE "name" IS NOT NULL AND btrim("name") <> '';

-- Every account can act as a guest. Existing hosts keep HOST as their active mode.
INSERT INTO "public"."UserRole" ("userId", "role")
SELECT "id", 'GUEST'::"public"."Role"
FROM "public"."User"
ON CONFLICT ("userId", "role") DO NOTHING;

UPDATE "public"."User" AS u
SET "activeMode" = 'HOST'::"public"."ProfileMode"
WHERE EXISTS (
  SELECT 1
  FROM "public"."UserRole" AS ur
  WHERE ur."userId" = u."id" AND ur."role" = 'HOST'::"public"."Role"
);

CREATE TABLE "public"."RefreshSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedById" TEXT,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshSession_tokenHash_key"
ON "public"."RefreshSession"("tokenHash");

CREATE INDEX "RefreshSession_userId_revokedAt_idx"
ON "public"."RefreshSession"("userId", "revokedAt");

CREATE INDEX "RefreshSession_familyId_revokedAt_idx"
ON "public"."RefreshSession"("familyId", "revokedAt");

CREATE INDEX "RefreshSession_expiresAt_idx"
ON "public"."RefreshSession"("expiresAt");

ALTER TABLE "public"."RefreshSession"
ADD CONSTRAINT "RefreshSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
