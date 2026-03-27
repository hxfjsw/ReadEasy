// Reader page types and interfaces

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export interface LoadingState {
  isLoading: boolean;
  stage: 'reading' | 'parsing' | 'rendering' | 'analyzing' | 'complete';
  progress: number;
  message: string;
}

// Vocabulary levels
export const levelOrder = [
  'elementary',
  'middle',
  'high',
  'cet4',
  'cet6',
  'postgraduate',
  'ielts',
  'toefl',
  'gre',
  'tem8',
] as const;

export type VocabularyLevelType = typeof levelOrder[number];

export interface ReaderPageProps {
  initialFilePath?: string;
  onClearInitialFile?: () => void;
}
