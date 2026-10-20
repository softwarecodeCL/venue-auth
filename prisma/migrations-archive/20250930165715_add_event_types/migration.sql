-- AlterTable
ALTER TABLE "webapi"."Listing" ADD COLUMN     "eventTypeId" TEXT;

-- CreateTable
CREATE TABLE "webapi"."event_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleEs" TEXT NOT NULL,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_types_slug_key" ON "webapi"."event_types"("slug");

-- CreateIndex
CREATE INDEX "Listing_eventTypeId_idx" ON "webapi"."Listing"("eventTypeId");

-- AddForeignKey
ALTER TABLE "webapi"."Listing" ADD CONSTRAINT "Listing_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "webapi"."event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
