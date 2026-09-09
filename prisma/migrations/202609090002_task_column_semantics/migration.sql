CREATE TYPE "TaskColumnSemantic" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'OPEN');

ALTER TABLE "TaskColumn" ADD COLUMN "semantic" "TaskColumnSemantic";

UPDATE "TaskColumn"
SET "semantic" = CASE
  WHEN "isDone" THEN 'DONE'::"TaskColumnSemantic"
  WHEN LOWER("name") = 'backlog' THEN 'BACKLOG'::"TaskColumnSemantic"
  WHEN LOWER("name") IN ('in progress', 'building', 'creating', 'designing') THEN 'IN_PROGRESS'::"TaskColumnSemantic"
  WHEN LOWER("name") IN ('review', 'approved', 'evidence', 'offer') THEN 'REVIEW'::"TaskColumnSemantic"
  WHEN "isInitial" AND LOWER("name") = 'open' THEN 'OPEN'::"TaskColumnSemantic"
  ELSE 'TODO'::"TaskColumnSemantic"
END;

ALTER TABLE "TaskColumn" ALTER COLUMN "semantic" SET NOT NULL;
