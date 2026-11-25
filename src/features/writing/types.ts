import type { AIGradeResult, WritingPrompt } from '../../types/cet4';

export type WritingCategoryFilter = '全部' | WritingPrompt['category'];

export interface WritingDraft {
  promptId: string;
  content: string;
  updatedAt: string;
}

export interface SelfCheckCriterion {
  id: string;
  label: string;
  description: string;
}

export interface WritingSubmission {
  id: string;
  promptId: string;
  promptTitle: string;
  category: WritingPrompt['category'];
  essay: string;
  wordCount: number;
  durationSeconds: number;
  selfChecks: string[];
  aiResult?: AIGradeResult;
  createdAt: string;
}
