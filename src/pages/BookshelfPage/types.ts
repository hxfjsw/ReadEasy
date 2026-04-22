import type { ReadingRecord } from '../../types';

export interface BookshelfItem extends ReadingRecord {
  id: number;
  bookName: string;
  filePath: string;
  file_path?: string;
  format: string;
  progress: number;
  lastReadAt: Date;
  last_read_at?: Date;
}

export interface BookshelfPageProps {
  onOpenBook?: (filePath: string) => void;
}

export interface ExtractedWord {
  word: string;
  count: number;
  example?: string;
  definitionCn?: string;
  phoneticUs?: string;
}
