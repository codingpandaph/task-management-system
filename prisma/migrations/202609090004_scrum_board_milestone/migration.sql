ALTER TABLE "Milestone" ADD COLUMN "boardId" UUID;

ALTER TABLE "Milestone" ALTER COLUMN "dueDate" TYPE DATE USING "dueDate"::date;

CREATE UNIQUE INDEX "Milestone_boardId_key" ON "Milestone"("boardId");

ALTER TABLE "Milestone"
ADD CONSTRAINT "Milestone_boardId_fkey"
FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
