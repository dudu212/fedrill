import type { AlgorithmProblem } from '@/lib/types/problem'
import bubbleSort from './bubble-sort'

export const algoProblems: AlgorithmProblem[] = [bubbleSort]

export const algoProblemsById: Record<string, AlgorithmProblem> = Object.fromEntries(
  algoProblems.map((p) => [p.id, p]),
)

export function getAlgoProblem(id: string): AlgorithmProblem | undefined {
  return algoProblemsById[id]
}
