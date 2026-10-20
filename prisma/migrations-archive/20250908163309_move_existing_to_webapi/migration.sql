/*
  Warnings:

  - You are about to drop the `AmenityCatalog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Booking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExperienceAddon` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExperienceDetails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExperiencePricing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Listing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ListingAddress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ListingTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LodgingAmenity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LodgingAvailability` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LodgingDetails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LodgingPricing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LodgingSafety` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MediaAsset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReviewHelpful` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReviewReply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceAgendaException` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceAgendaSlot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceDetails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceLicense` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServicePortfolio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServicePricing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tag` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "webapi";

-- CreateEnum
CREATE TYPE "webapi"."ListingCategory" AS ENUM ('ALOJAMIENTO', 'EXPERIENCIA', 'SERVICIO');

-- CreateEnum
CREATE TYPE "webapi"."ListingStatus" AS ENUM ('DRAFT', 'PENDING_PUBLISH', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "webapi"."RoomKind" AS ENUM ('ENTIRE', 'PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "webapi"."Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "webapi"."FitnessLevel" AS ENUM ('LOW', 'MID', 'HIGH');

-- CreateEnum
CREATE TYPE "webapi"."ServiceModality" AS ENUM ('ONSITE', 'INSHOP', 'REMOTE');

-- CreateEnum
CREATE TYPE "webapi"."PriceModel" AS ENUM ('NIGHTLY', 'PER_PERSON', 'HOURLY', 'FIXED');

-- CreateEnum
CREATE TYPE "webapi"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "webapi"."ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "webapi"."MediaKind" AS ENUM ('PHOTO', 'VIDEO', 'DOC');

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_guestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExperienceAddon" DROP CONSTRAINT "ExperienceAddon_experienceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExperienceDetails" DROP CONSTRAINT "ExperienceDetails_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExperiencePricing" DROP CONSTRAINT "ExperiencePricing_experienceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Favorite" DROP CONSTRAINT "Favorite_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Favorite" DROP CONSTRAINT "Favorite_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Listing" DROP CONSTRAINT "Listing_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ListingAddress" DROP CONSTRAINT "ListingAddress_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ListingTag" DROP CONSTRAINT "ListingTag_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ListingTag" DROP CONSTRAINT "ListingTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LodgingAmenity" DROP CONSTRAINT "LodgingAmenity_amenityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LodgingAmenity" DROP CONSTRAINT "LodgingAmenity_lodgingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LodgingAvailability" DROP CONSTRAINT "LodgingAvailability_lodgingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LodgingDetails" DROP CONSTRAINT "LodgingDetails_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LodgingPricing" DROP CONSTRAINT "LodgingPricing_lodgingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LodgingSafety" DROP CONSTRAINT "LodgingSafety_amenityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LodgingSafety" DROP CONSTRAINT "LodgingSafety_lodgingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MediaAsset" DROP CONSTRAINT "MediaAsset_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReviewHelpful" DROP CONSTRAINT "ReviewHelpful_reviewId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReviewHelpful" DROP CONSTRAINT "ReviewHelpful_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReviewReply" DROP CONSTRAINT "ReviewReply_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReviewReply" DROP CONSTRAINT "ReviewReply_reviewId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceAgendaException" DROP CONSTRAINT "ServiceAgendaException_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceAgendaSlot" DROP CONSTRAINT "ServiceAgendaSlot_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceDetails" DROP CONSTRAINT "ServiceDetails_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceLicense" DROP CONSTRAINT "ServiceLicense_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServicePortfolio" DROP CONSTRAINT "ServicePortfolio_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServicePricing" DROP CONSTRAINT "ServicePricing_serviceId_fkey";

-- DropTable
DROP TABLE "public"."AmenityCatalog";

-- DropTable
DROP TABLE "public"."Booking";

-- DropTable
DROP TABLE "public"."ExperienceAddon";

-- DropTable
DROP TABLE "public"."ExperienceDetails";

-- DropTable
DROP TABLE "public"."ExperiencePricing";

-- DropTable
DROP TABLE "public"."Favorite";

-- DropTable
DROP TABLE "public"."Listing";

-- DropTable
DROP TABLE "public"."ListingAddress";

-- DropTable
DROP TABLE "public"."ListingTag";

-- DropTable
DROP TABLE "public"."LodgingAmenity";

-- DropTable
DROP TABLE "public"."LodgingAvailability";

-- DropTable
DROP TABLE "public"."LodgingDetails";

-- DropTable
DROP TABLE "public"."LodgingPricing";

-- DropTable
DROP TABLE "public"."LodgingSafety";

-- DropTable
DROP TABLE "public"."MediaAsset";

-- DropTable
DROP TABLE "public"."Review";

-- DropTable
DROP TABLE "public"."ReviewHelpful";

-- DropTable
DROP TABLE "public"."ReviewReply";

-- DropTable
DROP TABLE "public"."ServiceAgendaException";

-- DropTable
DROP TABLE "public"."ServiceAgendaSlot";

-- DropTable
DROP TABLE "public"."ServiceDetails";

-- DropTable
DROP TABLE "public"."ServiceLicense";

-- DropTable
DROP TABLE "public"."ServicePortfolio";

-- DropTable
DROP TABLE "public"."ServicePricing";

-- DropTable
DROP TABLE "public"."Tag";

-- DropEnum
DROP TYPE "public"."BookingStatus";

-- DropEnum
DROP TYPE "public"."Difficulty";

-- DropEnum
DROP TYPE "public"."FitnessLevel";

-- DropEnum
DROP TYPE "public"."ListingCategory";

-- DropEnum
DROP TYPE "public"."ListingStatus";

-- DropEnum
DROP TYPE "public"."MediaKind";

-- DropEnum
DROP TYPE "public"."PriceModel";

-- DropEnum
DROP TYPE "public"."ReviewStatus";

-- DropEnum
DROP TYPE "public"."RoomKind";

-- DropEnum
DROP TYPE "public"."ServiceModality";

-- CreateTable
CREATE TABLE "webapi"."Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "category" "webapi"."ListingCategory" NOT NULL,
    "status" "webapi"."ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "highlights" TEXT[],
    "language" TEXT,
    "currency" "public"."Currency" NOT NULL DEFAULT 'CLP',
    "coverImage" TEXT,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ListingAddress" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "zip" TEXT,
    "line1" TEXT,
    "line2" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "ListingAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."MediaAsset" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" "webapi"."MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ListingTag" (
    "listingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ListingTag_pkey" PRIMARY KEY ("listingId","tagId")
);

-- CreateTable
CREATE TABLE "webapi"."LodgingDetails" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "roomKind" "webapi"."RoomKind" NOT NULL,
    "guests" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "beds" INTEGER NOT NULL,
    "baths" INTEGER NOT NULL,
    "checkIn" TEXT,
    "checkOut" TEXT,
    "petsAllowed" BOOLEAN DEFAULT false,
    "smokingAllowed" BOOLEAN DEFAULT false,
    "eventsAllowed" BOOLEAN DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,

    CONSTRAINT "LodgingDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."AmenityCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "AmenityCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."LodgingAmenity" (
    "lodgingId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "LodgingAmenity_pkey" PRIMARY KEY ("lodgingId","amenityId")
);

-- CreateTable
CREATE TABLE "webapi"."LodgingSafety" (
    "lodgingId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "LodgingSafety_pkey" PRIMARY KEY ("lodgingId","amenityId")
);

-- CreateTable
CREATE TABLE "webapi"."LodgingPricing" (
    "id" TEXT NOT NULL,
    "lodgingId" TEXT NOT NULL,
    "pricePerNight" DECIMAL(10,2) NOT NULL,
    "cleaningFee" DECIMAL(10,2),
    "extraGuestFrom" INTEGER,
    "extraGuestFee" DECIMAL(10,2),
    "taxesPercent" DECIMAL(5,2),
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "maxNights" INTEGER,
    "deposit" DECIMAL(10,2),

    CONSTRAINT "LodgingPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."LodgingAvailability" (
    "id" TEXT NOT NULL,
    "lodgingId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "LodgingAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ExperienceDetails" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "difficulty" "webapi"."Difficulty" NOT NULL,
    "fitnessLevel" "webapi"."FitnessLevel",
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "weightMinKg" INTEGER,
    "weightMaxKg" INTEGER,
    "heightMinCm" INTEGER,
    "heightMaxCm" INTEGER,
    "requiredSkills" TEXT[],
    "languages" TEXT[],
    "meetingLat" DOUBLE PRECISION NOT NULL,
    "meetingLon" DOUBLE PRECISION NOT NULL,
    "meetingAddr" TEXT NOT NULL,
    "meetingNotes" TEXT,
    "finishLat" DOUBLE PRECISION,
    "finishLon" DOUBLE PRECISION,
    "finishAddr" TEXT,
    "durationMin" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "startTimes" TEXT[],
    "seasonFrom" TIMESTAMP(3),
    "seasonTo" TIMESTAMP(3),
    "leadTimeHours" INTEGER,
    "cutoffHours" INTEGER,
    "bufferMin" INTEGER,
    "minGuests" INTEGER NOT NULL,
    "maxGuests" INTEGER NOT NULL,
    "privateOption" BOOLEAN NOT NULL DEFAULT false,
    "guideToGuestRatio" TEXT,
    "includes" TEXT[],
    "excludes" TEXT[],
    "foodOptions" TEXT[],
    "waterProvided" BOOLEAN NOT NULL DEFAULT false,
    "waiverRequired" BOOLEAN NOT NULL DEFAULT false,
    "waiverDocUrl" TEXT,
    "insuranceProvided" BOOLEAN NOT NULL DEFAULT false,
    "permits" TEXT[],
    "certifications" TEXT[],
    "emergencyPlan" TEXT,
    "weatherPolicy" TEXT,
    "cancellationPolicy" TEXT,
    "subtypeExtra" JSONB,

    CONSTRAINT "ExperienceDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ExperiencePricing" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "priceAdult" DECIMAL(10,2) NOT NULL,
    "priceChild" DECIMAL(10,2),
    "privateGroupPrice" DECIMAL(10,2),
    "taxesPercent" DECIMAL(5,2),

    CONSTRAINT "ExperiencePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ExperienceAddon" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ExperienceAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ServiceDetails" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "modality" "webapi"."ServiceModality" NOT NULL,
    "baseLat" DOUBLE PRECISION NOT NULL,
    "baseLon" DOUBLE PRECISION NOT NULL,
    "baseAddress" TEXT NOT NULL,
    "areaType" TEXT NOT NULL,
    "radiusKm" DOUBLE PRECISION,
    "polygonGeo" JSONB,
    "travelFee" DECIMAL(10,2),
    "leadTimeHr" INTEGER,
    "bufferMin" INTEGER,
    "minHours" INTEGER,
    "openingHours" TEXT,

    CONSTRAINT "ServiceDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ServiceAgendaSlot" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,

    CONSTRAINT "ServiceAgendaSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ServiceAgendaException" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,

    CONSTRAINT "ServiceAgendaException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ServicePricing" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "model" "webapi"."PriceModel" NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "fixedPrice" DECIMAL(10,2),
    "calloutFee" DECIMAL(10,2),
    "materials" DECIMAL(10,2),
    "taxesPercent" DECIMAL(5,2),

    CONSTRAINT "ServicePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ServiceLicense" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT,
    "issuer" TEXT,
    "validUntil" TIMESTAMP(3),
    "fileUrl" TEXT,

    CONSTRAINT "ServiceLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ServicePortfolio" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServicePortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."Booking" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER,
    "adults" INTEGER,
    "children" INTEGER,
    "currency" "public"."Currency" NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "breakdown" JSONB,
    "status" "webapi"."BookingStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."Review" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "status" "webapi"."ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webapi"."ReviewHelpful" (
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewHelpful_pkey" PRIMARY KEY ("reviewId","userId")
);

-- CreateTable
CREATE TABLE "webapi"."Favorite" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "webapi"."Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_category_status_createdAt_idx" ON "webapi"."Listing"("category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_ownerId_status_idx" ON "webapi"."Listing"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ListingAddress_listingId_key" ON "webapi"."ListingAddress"("listingId");

-- CreateIndex
CREATE INDEX "ListingAddress_country_city_idx" ON "webapi"."ListingAddress"("country", "city");

-- CreateIndex
CREATE INDEX "ListingAddress_latitude_longitude_idx" ON "webapi"."ListingAddress"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "MediaAsset_listingId_kind_idx" ON "webapi"."MediaAsset"("listingId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "webapi"."Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LodgingDetails_listingId_key" ON "webapi"."LodgingDetails"("listingId");

-- CreateIndex
CREATE INDEX "LodgingDetails_propertyType_roomKind_idx" ON "webapi"."LodgingDetails"("propertyType", "roomKind");

-- CreateIndex
CREATE INDEX "LodgingDetails_guests_idx" ON "webapi"."LodgingDetails"("guests");

-- CreateIndex
CREATE UNIQUE INDEX "AmenityCatalog_code_key" ON "webapi"."AmenityCatalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LodgingPricing_lodgingId_key" ON "webapi"."LodgingPricing"("lodgingId");

-- CreateIndex
CREATE INDEX "LodgingAvailability_lodgingId_startDate_endDate_idx" ON "webapi"."LodgingAvailability"("lodgingId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceDetails_listingId_key" ON "webapi"."ExperienceDetails"("listingId");

-- CreateIndex
CREATE INDEX "ExperienceDetails_meetingLat_meetingLon_idx" ON "webapi"."ExperienceDetails"("meetingLat", "meetingLon");

-- CreateIndex
CREATE UNIQUE INDEX "ExperiencePricing_experienceId_key" ON "webapi"."ExperiencePricing"("experienceId");

-- CreateIndex
CREATE INDEX "ExperienceAddon_experienceId_name_idx" ON "webapi"."ExperienceAddon"("experienceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDetails_listingId_key" ON "webapi"."ServiceDetails"("listingId");

-- CreateIndex
CREATE INDEX "ServiceDetails_serviceType_modality_idx" ON "webapi"."ServiceDetails"("serviceType", "modality");

-- CreateIndex
CREATE INDEX "ServiceDetails_baseLat_baseLon_idx" ON "webapi"."ServiceDetails"("baseLat", "baseLon");

-- CreateIndex
CREATE INDEX "ServiceAgendaSlot_serviceId_dayOfWeek_idx" ON "webapi"."ServiceAgendaSlot"("serviceId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePricing_serviceId_key" ON "webapi"."ServicePricing"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceLicense_serviceId_kind_idx" ON "webapi"."ServiceLicense"("serviceId", "kind");

-- CreateIndex
CREATE INDEX "ServicePortfolio_serviceId_position_idx" ON "webapi"."ServicePortfolio"("serviceId", "position");

-- CreateIndex
CREATE INDEX "Booking_listingId_startAt_endAt_idx" ON "webapi"."Booking"("listingId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Booking_guestId_status_idx" ON "webapi"."Booking"("guestId", "status");

-- CreateIndex
CREATE INDEX "Review_listingId_createdAt_idx" ON "webapi"."Review"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_authorId_createdAt_idx" ON "webapi"."Review"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_authorId_key" ON "webapi"."Review"("bookingId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReply_reviewId_key" ON "webapi"."ReviewReply"("reviewId");

-- CreateIndex
CREATE INDEX "Favorite_listingId_createdAt_idx" ON "webapi"."Favorite"("listingId", "createdAt");

-- AddForeignKey
ALTER TABLE "webapi"."Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingAddress" ADD CONSTRAINT "ListingAddress_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."MediaAsset" ADD CONSTRAINT "MediaAsset_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingTag" ADD CONSTRAINT "ListingTag_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ListingTag" ADD CONSTRAINT "ListingTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "webapi"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."LodgingDetails" ADD CONSTRAINT "LodgingDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."LodgingAmenity" ADD CONSTRAINT "LodgingAmenity_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "webapi"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."LodgingAmenity" ADD CONSTRAINT "LodgingAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "webapi"."AmenityCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."LodgingSafety" ADD CONSTRAINT "LodgingSafety_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "webapi"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."LodgingSafety" ADD CONSTRAINT "LodgingSafety_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "webapi"."AmenityCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."LodgingPricing" ADD CONSTRAINT "LodgingPricing_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "webapi"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."LodgingAvailability" ADD CONSTRAINT "LodgingAvailability_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "webapi"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ExperienceDetails" ADD CONSTRAINT "ExperienceDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ExperiencePricing" ADD CONSTRAINT "ExperiencePricing_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "webapi"."ExperienceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ExperienceAddon" ADD CONSTRAINT "ExperienceAddon_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "webapi"."ExperienceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ServiceDetails" ADD CONSTRAINT "ServiceDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ServiceAgendaSlot" ADD CONSTRAINT "ServiceAgendaSlot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "webapi"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ServiceAgendaException" ADD CONSTRAINT "ServiceAgendaException_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "webapi"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ServicePricing" ADD CONSTRAINT "ServicePricing_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "webapi"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ServiceLicense" ADD CONSTRAINT "ServiceLicense_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "webapi"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ServicePortfolio" ADD CONSTRAINT "ServicePortfolio_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "webapi"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."Booking" ADD CONSTRAINT "Booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."Review" ADD CONSTRAINT "Review_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "webapi"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ReviewReply" ADD CONSTRAINT "ReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "webapi"."Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ReviewReply" ADD CONSTRAINT "ReviewReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ReviewHelpful" ADD CONSTRAINT "ReviewHelpful_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "webapi"."Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."ReviewHelpful" ADD CONSTRAINT "ReviewHelpful_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webapi"."Favorite" ADD CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "webapi"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
