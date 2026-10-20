-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('GUEST', 'HOST', 'GUIDE', 'SERVICE_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('CLP', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "public"."KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ListingCategory" AS ENUM ('ALOJAMIENTO', 'EXPERIENCIA', 'SERVICIO');

-- CreateEnum
CREATE TYPE "public"."ListingStatus" AS ENUM ('DRAFT', 'PENDING_PUBLISH', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."RoomKind" AS ENUM ('ENTIRE', 'PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "public"."Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "public"."FitnessLevel" AS ENUM ('LOW', 'MID', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."ServiceModality" AS ENUM ('ONSITE', 'INSHOP', 'REMOTE');

-- CreateEnum
CREATE TYPE "public"."PriceModel" AS ENUM ('NIGHTLY', 'PER_PERSON', 'HOURLY', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "public"."MediaKind" AS ENUM ('PHOTO', 'VIDEO', 'DOC');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "defaultCurrency" "public"."Currency",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "userId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "public"."NotificationSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailOnBooking" BOOLEAN NOT NULL DEFAULT true,
    "emailOnMessage" BOOLEAN NOT NULL DEFAULT true,
    "pushOnBooking" BOOLEAN NOT NULL DEFAULT true,
    "pushOnMessage" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalType" TEXT,
    "legalName" TEXT,
    "taxId" TEXT,
    "kycStatus" "public"."KycStatus" NOT NULL DEFAULT 'NONE',
    "stripeCustomerId" TEXT,
    "stripeAccountId" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "category" "public"."ListingCategory" NOT NULL,
    "status" "public"."ListingStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "public"."ListingAddress" (
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
CREATE TABLE "public"."MediaAsset" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" "public"."MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ListingTag" (
    "listingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ListingTag_pkey" PRIMARY KEY ("listingId","tagId")
);

-- CreateTable
CREATE TABLE "public"."LodgingDetails" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "roomKind" "public"."RoomKind" NOT NULL,
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
CREATE TABLE "public"."AmenityCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "AmenityCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LodgingAmenity" (
    "lodgingId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "LodgingAmenity_pkey" PRIMARY KEY ("lodgingId","amenityId")
);

-- CreateTable
CREATE TABLE "public"."LodgingSafety" (
    "lodgingId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "LodgingSafety_pkey" PRIMARY KEY ("lodgingId","amenityId")
);

-- CreateTable
CREATE TABLE "public"."LodgingPricing" (
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
CREATE TABLE "public"."LodgingAvailability" (
    "id" TEXT NOT NULL,
    "lodgingId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "LodgingAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExperienceDetails" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "difficulty" "public"."Difficulty" NOT NULL,
    "fitnessLevel" "public"."FitnessLevel",
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
CREATE TABLE "public"."ExperiencePricing" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "priceAdult" DECIMAL(10,2) NOT NULL,
    "priceChild" DECIMAL(10,2),
    "privateGroupPrice" DECIMAL(10,2),
    "taxesPercent" DECIMAL(5,2),

    CONSTRAINT "ExperiencePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExperienceAddon" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ExperienceAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceDetails" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "modality" "public"."ServiceModality" NOT NULL,
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
CREATE TABLE "public"."ServiceAgendaSlot" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,

    CONSTRAINT "ServiceAgendaSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceAgendaException" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,

    CONSTRAINT "ServiceAgendaException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServicePricing" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "model" "public"."PriceModel" NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "fixedPrice" DECIMAL(10,2),
    "calloutFee" DECIMAL(10,2),
    "materials" DECIMAL(10,2),
    "taxesPercent" DECIMAL(5,2),

    CONSTRAINT "ServicePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceLicense" (
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
CREATE TABLE "public"."ServicePortfolio" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServicePortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
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
    "status" "public"."BookingStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "status" "public"."ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewHelpful" (
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewHelpful_pkey" PRIMARY KEY ("reviewId","userId")
);

-- CreateTable
CREATE TABLE "public"."Favorite" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateIndex
CREATE INDEX "NotificationSetting_userId_idx" ON "public"."NotificationSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "public"."ProviderProfile"("userId");

-- CreateIndex
CREATE INDEX "ProviderProfile_kycStatus_idx" ON "public"."ProviderProfile"("kycStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "public"."Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_category_status_createdAt_idx" ON "public"."Listing"("category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_ownerId_status_idx" ON "public"."Listing"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ListingAddress_listingId_key" ON "public"."ListingAddress"("listingId");

-- CreateIndex
CREATE INDEX "ListingAddress_country_city_idx" ON "public"."ListingAddress"("country", "city");

-- CreateIndex
CREATE INDEX "ListingAddress_latitude_longitude_idx" ON "public"."ListingAddress"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "MediaAsset_listingId_kind_idx" ON "public"."MediaAsset"("listingId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "public"."Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LodgingDetails_listingId_key" ON "public"."LodgingDetails"("listingId");

-- CreateIndex
CREATE INDEX "LodgingDetails_propertyType_roomKind_idx" ON "public"."LodgingDetails"("propertyType", "roomKind");

-- CreateIndex
CREATE INDEX "LodgingDetails_guests_idx" ON "public"."LodgingDetails"("guests");

-- CreateIndex
CREATE UNIQUE INDEX "AmenityCatalog_code_key" ON "public"."AmenityCatalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LodgingPricing_lodgingId_key" ON "public"."LodgingPricing"("lodgingId");

-- CreateIndex
CREATE INDEX "LodgingAvailability_lodgingId_startDate_endDate_idx" ON "public"."LodgingAvailability"("lodgingId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceDetails_listingId_key" ON "public"."ExperienceDetails"("listingId");

-- CreateIndex
CREATE INDEX "ExperienceDetails_meetingLat_meetingLon_idx" ON "public"."ExperienceDetails"("meetingLat", "meetingLon");

-- CreateIndex
CREATE UNIQUE INDEX "ExperiencePricing_experienceId_key" ON "public"."ExperiencePricing"("experienceId");

-- CreateIndex
CREATE INDEX "ExperienceAddon_experienceId_name_idx" ON "public"."ExperienceAddon"("experienceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDetails_listingId_key" ON "public"."ServiceDetails"("listingId");

-- CreateIndex
CREATE INDEX "ServiceDetails_serviceType_modality_idx" ON "public"."ServiceDetails"("serviceType", "modality");

-- CreateIndex
CREATE INDEX "ServiceDetails_baseLat_baseLon_idx" ON "public"."ServiceDetails"("baseLat", "baseLon");

-- CreateIndex
CREATE INDEX "ServiceAgendaSlot_serviceId_dayOfWeek_idx" ON "public"."ServiceAgendaSlot"("serviceId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePricing_serviceId_key" ON "public"."ServicePricing"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceLicense_serviceId_kind_idx" ON "public"."ServiceLicense"("serviceId", "kind");

-- CreateIndex
CREATE INDEX "ServicePortfolio_serviceId_position_idx" ON "public"."ServicePortfolio"("serviceId", "position");

-- CreateIndex
CREATE INDEX "Booking_listingId_startAt_endAt_idx" ON "public"."Booking"("listingId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Booking_guestId_status_idx" ON "public"."Booking"("guestId", "status");

-- CreateIndex
CREATE INDEX "Review_listingId_createdAt_idx" ON "public"."Review"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_authorId_createdAt_idx" ON "public"."Review"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_authorId_key" ON "public"."Review"("bookingId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReply_reviewId_key" ON "public"."ReviewReply"("reviewId");

-- CreateIndex
CREATE INDEX "Favorite_listingId_createdAt_idx" ON "public"."Favorite"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthProvider_userId_provider_idx" ON "public"."AuthProvider"("userId", "provider");

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationSetting" ADD CONSTRAINT "NotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListingAddress" ADD CONSTRAINT "ListingAddress_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListingTag" ADD CONSTRAINT "ListingTag_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListingTag" ADD CONSTRAINT "ListingTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LodgingDetails" ADD CONSTRAINT "LodgingDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LodgingAmenity" ADD CONSTRAINT "LodgingAmenity_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "public"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LodgingAmenity" ADD CONSTRAINT "LodgingAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "public"."AmenityCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LodgingSafety" ADD CONSTRAINT "LodgingSafety_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "public"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LodgingSafety" ADD CONSTRAINT "LodgingSafety_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "public"."AmenityCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LodgingPricing" ADD CONSTRAINT "LodgingPricing_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "public"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LodgingAvailability" ADD CONSTRAINT "LodgingAvailability_lodgingId_fkey" FOREIGN KEY ("lodgingId") REFERENCES "public"."LodgingDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperienceDetails" ADD CONSTRAINT "ExperienceDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperiencePricing" ADD CONSTRAINT "ExperiencePricing_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "public"."ExperienceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperienceAddon" ADD CONSTRAINT "ExperienceAddon_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "public"."ExperienceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceDetails" ADD CONSTRAINT "ServiceDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAgendaSlot" ADD CONSTRAINT "ServiceAgendaSlot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAgendaException" ADD CONSTRAINT "ServiceAgendaException_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServicePricing" ADD CONSTRAINT "ServicePricing_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceLicense" ADD CONSTRAINT "ServiceLicense_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServicePortfolio" ADD CONSTRAINT "ServicePortfolio_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."ServiceDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewReply" ADD CONSTRAINT "ReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewReply" ADD CONSTRAINT "ReviewReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewHelpful" ADD CONSTRAINT "ReviewHelpful_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewHelpful" ADD CONSTRAINT "ReviewHelpful_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
