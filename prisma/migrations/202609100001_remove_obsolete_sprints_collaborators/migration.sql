ALTER TABLE "Task" DROP CONSTRAINT "Task_sprintId_fkey";

DROP INDEX "Task_sprintId_idx";

ALTER TABLE "Task" DROP COLUMN "sprintId";

DROP TABLE "Sprint";

DROP TABLE "BoardCollaborator";

DROP TYPE "SprintStatus";
