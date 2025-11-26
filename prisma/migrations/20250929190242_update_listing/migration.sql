-- CreateEnum
CREATE TYPE "webapi"."CancellationPolicy" AS ENUM ('VERY_FLEXIBLE', 'FLEXIBLE', 'STANDARD_30', 'STANDARD_90');

-- CreateEnum
CREATE TYPE "webapi"."InstantBookMode" AS ENUM ('NONE', 'ALL');

-- CreateEnum
CREATE TYPE "webapi"."ActivityType" AS ENUM ('MEETING', 'WORKSHOP', 'PRESENTATION', 'RETREAT', 'BIRTHDAY', 'NETWORKING', 'CORPORATE_PARTY', 'FILM_SHOOT', 'PHOTO_SHOOT', 'AUDIO_RECORDING', 'OTHER');

-- CreateEnum
CREATE TYPE "webapi"."AccuracyLevel" AS ENUM ('CITY', 'STREET', 'ADDRESS');

-- CreateEnum
CREATE TYPE "webapi"."ModerationState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "webapi"."Listing" ADD COLUMN     "accuracyLevel" "webapi"."AccuracyLevel",
ADD COLUMN     "admin1" TEXT,
ADD COLUMN     "ageMin" INTEGER,
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "cancellation" "webapi"."CancellationPolicy",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "countryCode" CHAR(2),
ADD COLUMN     "displayAddress" TEXT,
ADD COLUMN     "floorAreaSqm" INTEGER,
ADD COLUMN     "geohash" TEXT,
ADD COLUMN     "geohash5" TEXT,
ADD COLUMN     "instantBook" "webapi"."InstantBookMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "locationSource" TEXT,
ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "longBookingDiscountPercent" DECIMAL(5,2),
ADD COLUMN     "longBookingDiscountThresholdHours" INTEGER,
ADD COLUMN     "maxGuests" INTEGER,
ADD COLUMN     "minBookingHours" INTEGER,
ADD COLUMN     "moderation" "webapi"."ModerationState" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "rules" TEXT[],
ADD COLUMN     "showApproximate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "webapi"."ServiceDetails" ADD COLUMN     "cameraNotes" TEXT,
ADD COLUMN     "capacityMax" INTEGER,
ADD COLUMN     "hasCameras" BOOLEAN DEFAULT false,
ADD COLUMN     "offersOvernight" BOOLEAN DEFAULT false,
ADD COLUMN     "spaceType" TEXT;

-- AlterTable
ALTER TABLE "webapi"."ServicePricing" ADD COLUMN     "cleaningFee" DECIMAL(10,2),
ADD COLUMN     "pricePerAttendee" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "webapi"."ListingAccessInfo" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "arrivalInstructions" TEXT,
    "parkingDetails" TEXT,
    "wifiSsid" TEXT,
    "wifiPassword" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListingAccessInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ListingHealthSafety" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "cleanedPerGuidelines" BOOLEAN NOT NULL DEFAULT false,
    "highTouchDisinfected" BOOLEAN NOT NULL DEFAULT false,
    "hepaFilters" BOOLEAN NOT NULL DEFAULT false,
    "outdoorSpace" BOOLEAN NOT NULL DEFAULT false,
    "distancingConfigured" BOOLEAN NOT NULL DEFAULT false,
    "masksProvided" BOOLEAN NOT NULL DEFAULT false,
    "glovesProvided" BOOLEAN NOT NULL DEFAULT false,
    "sanitizerProvided" BOOLEAN NOT NULL DEFAULT false,
    "signageDeployed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ListingHealthSafety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ServiceAllowedActivity" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "type" "webapi"."ActivityType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "minHours" INTEGER,
    "instantBook" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER,
    "cleaningFee" DECIMAL(10,2),

    CONSTRAINT "ServiceAllowedActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ListingAddon" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ListingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ListingAmenity" (
    "listingId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "ListingAmenity_pkey" PRIMARY KEY ("listingId","amenityId")
);

-- CreateTable
CREATE TABLE "webapi"."Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "admin1" TEXT,
    "admin2" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "provider" TEXT,
    "providerPlaceId" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingAccessInfo_listingId_key" ON "webapi"."ListingAccessInfo"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingHealthSafety_listingId_key" ON "webapi"."ListingHealthSafety"("listingId");

-- CreateIndex
CREATE INDEX "ServiceAllowedActivity_serviceId_type_idx" ON "webapi"."ServiceAllowedActivity"("serviceId", "type");

-- CreateIndex
CREATE INDEX "ListingAddon_listingId_name_idx" ON "webapi"."ListingAddon"("listingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_providerPlaceId_key" ON "webapi"."Location"("providerPlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "webapi"."Location"("slug");

-- CreateIndex
CREATE INDEX "Listing_status_publishedAt_idx" ON "webapi"."Listing"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Listing_status_geohash5_createdAt_idx" ON "webapi"."Listing"("status", "geohash5", "createdAt");

-- AddForeignKey
ALTER TABLE "webapi"."Listing" ADD CONSTRAINT "Listing_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "webapi"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingAccessInfo" ADD CONSTRAINT "ListingAccessInfo_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingHealthSafety" ADD CONSTRAINT "ListingHealthSafety_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ServiceAllowedActivity" ADD CONSTRAINT "ServiceAllowedActivity_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "webapi"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingAddon" ADD CONSTRAINT "ListingAddon_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingAmenity" ADD CONSTRAINT "ListingAmenity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingAmenity" ADD CONSTRAINT "ListingAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "webapi"."AmenityCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
