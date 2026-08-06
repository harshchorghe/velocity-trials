-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "activeMarker" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "GameSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Level1Progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "clueAttempts" INTEGER NOT NULL DEFAULT 0,
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    CONSTRAINT "Level1Progress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "answerCode" TEXT NOT NULL,
    "location" TEXT
);

-- CreateTable
CREATE TABLE "ClueSolve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level1Id" TEXT NOT NULL,
    "clueIndex" INTEGER NOT NULL,
    "solvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClueSolve_level1Id_fkey" FOREIGN KEY ("level1Id") REFERENCES "Level1Progress" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Level2Progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "power" TEXT NOT NULL,
    "lives" INTEGER NOT NULL DEFAULT 3,
    "crystalsCollected" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "failed" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    CONSTRAINT "Level2Progress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrystalCollect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level2Id" TEXT NOT NULL,
    "crystalIndex" INTEGER NOT NULL,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrystalCollect_level2Id_fkey" FOREIGN KEY ("level2Id") REFERENCES "Level2Progress" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Level3Progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "weapon" TEXT,
    "bossHp" INTEGER NOT NULL DEFAULT 100,
    "playerHp" INTEGER NOT NULL DEFAULT 100,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "lastActionAt" DATETIME,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "champion" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Level3Progress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BossHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level3Id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "damage" INTEGER NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BossHit_level3Id_fkey" FOREIGN KEY ("level3Id") REFERENCES "Level3Progress" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_phone_key" ON "Player"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Player_rollNumber_key" ON "Player"("rollNumber");

-- CreateIndex
CREATE INDEX "Player_department_idx" ON "Player"("department");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_token_key" ON "GameSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_activeMarker_key" ON "GameSession"("activeMarker");

-- CreateIndex
CREATE INDEX "GameSession_playerId_idx" ON "GameSession"("playerId");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Level1Progress_sessionId_key" ON "Level1Progress"("sessionId");

-- CreateIndex
CREATE INDEX "Level1Progress_qualified_idx" ON "Level1Progress"("qualified");

-- CreateIndex
CREATE UNIQUE INDEX "Clue_index_key" ON "Clue"("index");

-- CreateIndex
CREATE UNIQUE INDEX "ClueSolve_level1Id_clueIndex_key" ON "ClueSolve"("level1Id", "clueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Level2Progress_sessionId_key" ON "Level2Progress"("sessionId");

-- CreateIndex
CREATE INDEX "Level2Progress_qualified_idx" ON "Level2Progress"("qualified");

-- CreateIndex
CREATE UNIQUE INDEX "CrystalCollect_level2Id_crystalIndex_key" ON "CrystalCollect"("level2Id", "crystalIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Level3Progress_sessionId_key" ON "Level3Progress"("sessionId");

-- CreateIndex
CREATE INDEX "Level3Progress_champion_idx" ON "Level3Progress"("champion");

-- CreateIndex
CREATE UNIQUE INDEX "BossHit_level3Id_seq_key" ON "BossHit"("level3Id", "seq");

-- CreateIndex
CREATE INDEX "GameEvent_type_idx" ON "GameEvent"("type");

-- CreateIndex
CREATE INDEX "GameEvent_at_idx" ON "GameEvent"("at");
