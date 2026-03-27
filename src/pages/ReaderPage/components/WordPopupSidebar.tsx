import WordPopup from '../../../components/WordPopup';

interface WordPopupSidebarProps {
  word: string;
  context: string;
  visible: boolean;
  bookName: string;
  onClose: () => void;
  onMasteredStatusChange: (word: string, isMastered: boolean) => void;
}

export const WordPopupSidebar: React.FC<WordPopupSidebarProps> = ({
  word,
  context,
  visible,
  bookName,
  onClose,
  onMasteredStatusChange,
}) => {
  return (
    <WordPopup
      word={word}
      context={context}
      visible={visible}
      onClose={onClose}
      onPlayPronunciation={(w) => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(w);
          utterance.lang = 'en-US';
          utterance.rate = 0.8;
          window.speechSynthesis.speak(utterance);
        }
      }}
      mode="sidebar"
      bookName={bookName}
      onMasteredStatusChange={onMasteredStatusChange}
    />
  );
};
