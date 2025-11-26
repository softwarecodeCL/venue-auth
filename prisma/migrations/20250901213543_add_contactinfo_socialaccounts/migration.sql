-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "aboutMe" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "public"."ContactInformation" (
    "id" TEXT NOT NULL,
    "address1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ContactInformation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialAccounts" (
    "id" TEXT NOT NULL,
    "facebook" TEXT,
    "twitter" TEXT,
    "linkedIn" TEXT,
    "dribbble" TEXT,
    "pinterest" TEXT,
    "vimeoUrl" TEXT,
    "youtubeUrl" TEXT,
    "websiteUrl" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SocialAccounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactInformation_userId_key" ON "public"."ContactInformation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccounts_userId_key" ON "public"."SocialAccounts"("userId");

-- AddForeignKey
ALTER TABLE "public"."ContactInformation" ADD CONSTRAINT "ContactInformation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialAccounts" ADD CONSTRAINT "SocialAccounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
