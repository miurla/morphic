-- Retain existing vectors while allowing new immutable indexes with other dimensions.
ALTER TABLE "tutor_chunks" ALTER COLUMN "embedding" TYPE vector USING "embedding"::vector;
