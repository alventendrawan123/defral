import proofArchive from '@/../docs/evidence/proof-archive.json';
import { proofArchiveSchema } from '@/services/schemas';
import type { ProofEntry } from '@/types';

export function readProofArchive(): ProofEntry[] {
  const parsed = proofArchiveSchema.parse(proofArchive);
  return [...parsed.entries].sort((a, b) => a.rank - b.rank);
}

export function readArchiveSourceFiles(): string[] {
  return proofArchiveSchema.parse(proofArchive).sourceFiles;
}
