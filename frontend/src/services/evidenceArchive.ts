import executionsArchive from '@/../docs/evidence/executions.json';
import outcomesArchive from '@/../docs/evidence/outcomes.json';
import { executionListSchema, outcomeComparisonListSchema } from '@/services/schemas';
import type { ExecutionView, OutcomeComparisonRow } from '@/types';

export function readArchivedExecutions(): ExecutionView[] {
  return executionListSchema.parse(executionsArchive);
}

export function readArchivedOutcomes(): OutcomeComparisonRow[] {
  return outcomeComparisonListSchema.parse(outcomesArchive);
}
