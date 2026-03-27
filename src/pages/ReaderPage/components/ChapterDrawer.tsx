import { Drawer } from 'antd';
import { Chapter } from '../../../types/reader';

interface ChapterDrawerProps {
  open: boolean;
  chapters: Chapter[];
  currentChapter: number;
  chapterStartPages: number[];
  totalPages: number;

  onClose: () => void;
  onChapterSelect: (index: number) => void;
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  open,
  chapters,
  currentChapter,
  chapterStartPages,
  totalPages,

  onClose,
  onChapterSelect,
}) => {
  return (
    <Drawer title="章节列表" placement="left" onClose={onClose} open={open} width={300}>
      <div className="space-y-1">
        {chapters.map((chapter, index) => {
          const startPage = chapterStartPages[index] || 0;
          const endPage = index < chapters.length - 1 ? (chapterStartPages[index + 1] || totalPages) - 1 : totalPages - 1;
          const isCurrent = currentChapter === index;
          
          return (
            <div
              key={chapter.id}
              className={`p-3 rounded cursor-pointer transition-colors ${isCurrent ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => onChapterSelect(index)}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium truncate flex-1">{index + 1}. {chapter.title}</div>
                <div className={`text-xs ml-2 ${isCurrent ? 'text-blue-500' : 'text-gray-400'}`}>P{startPage + 1}{startPage !== endPage && `-${endPage + 1}`}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
};
