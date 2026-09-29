-- AlterTable: UnityCredential supports Google link (email/googleSub) and Google-only rows.
ALTER TABLE "UnityCredential" ALTER COLUMN "salt" DROP NOT NULL;
ALTER TABLE "UnityCredential" ALTER COLUMN "hash" DROP NOT NULL;

ALTER TABLE "UnityCredential" ADD COLUMN "email" TEXT;
ALTER TABLE "UnityCredential" ADD COLUMN "googleSub" TEXT;

CREATE UNIQUE INDEX "UnityCredential_email_key" ON "UnityCredential"("email");
CREATE UNIQUE INDEX "UnityCredential_googleSub_key" ON "UnityCredential"("googleSub");
