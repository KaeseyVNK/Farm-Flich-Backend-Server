ALTER TABLE "User" ADD COLUMN "usernameSetupRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UnityCredential" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "UnityCredential_username_key" ON "UnityCredential"("username");
