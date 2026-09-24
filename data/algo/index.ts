import type { AlgorithmProblem } from '@/lib/types/problem'
import bubbleSort from './bubble-sort'
import selectionSort from './selection-sort'
import insertionSort from './insertion-sort'
import binarySearch from './binary-search'
import removeDuplicates from './remove-duplicates'
import mergeSortedArray from './merge-sorted-array'
import reverseString from './reverse-string'
import validParentheses from './valid-parentheses'
import climbingStairs from './climbing-stairs'
import maxSubarray from './max-subarray'

export const algoProblems: AlgorithmProblem[] = [
  bubbleSort,
  selectionSort,
  insertionSort,
  binarySearch,
  removeDuplicates,
  mergeSortedArray,
  maxSubarray,
  reverseString,
  validParentheses,
  climbingStairs,
]

export const algoProblemsById: Record<string, AlgorithmProblem> = Object.fromEntries(
  algoProblems.map((p) => [p.id, p]),
)

export function getAlgoProblem(id: string): AlgorithmProblem | undefined {
  return algoProblemsById[id]
}
