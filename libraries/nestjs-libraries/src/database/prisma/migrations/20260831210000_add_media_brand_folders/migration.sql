ALTER TABLE "Media"
ADD COLUMN "brand" TEXT,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Media_organizationId_brand_idx"
ON "Media"("organizationId", "brand");
