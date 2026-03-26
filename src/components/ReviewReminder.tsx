import { useEffect, useState } from 'react';
import { notification, Button, Badge } from 'antd';
import { BellOutlined, BookOutlined } from '@ant-design/icons';

interface ReviewWord {
  id: number;
  word: string;
  definitionCn?: string;
  addedAt: string;
  reviewStage: number;
  nextReviewAt: string;
}

// 艾宾浩斯遗忘曲线复习间隔（天数）
const reviewIntervals = [1, 2, 4, 7, 15, 30];

const ReviewReminder: React.FC = () => {
  const [pendingReviews, setPendingReviews] = useState<ReviewWord[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      checkReviews();
      setInitialized(true);
      
      // 每30分钟检查一次
      const interval = setInterval(checkReviews, 30 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [initialized]);

  const checkReviews = async () => {
    try {
      // 获取所有单词本中的单词
      const wordBooks = await window.electron.ipcRenderer.invoke('db:getWordBooks');
      const now = new Date();
      const dueWords: ReviewWord[] = [];

      for (const book of wordBooks) {
        const words = await window.electron.ipcRenderer.invoke('db:getWordsInBook', book.id);
        
        for (const word of words) {
          const addedAt = new Date(word.addedAt);
          const reviewStage = word.reviewStage || 0;
          const nextInterval = reviewIntervals[reviewStage] || reviewIntervals[reviewIntervals.length - 1];
          const nextReviewAt = new Date(addedAt);
          nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

          if (now >= nextReviewAt) {
            dueWords.push({
              id: word.id,
              word: word.word,
              definitionCn: word.definitionCn,
              addedAt: word.addedAt,
              reviewStage,
              nextReviewAt: nextReviewAt.toISOString(),
            });
          }
        }
      }

      setPendingReviews(dueWords);

      // 如果有需要复习的单词，显示通知
      if (dueWords.length > 0) {
        showReviewNotification(dueWords);
      }
    } catch (error) {
      console.error('检查复习单词失败:', error);
    }
  };

  const showReviewNotification = (words: ReviewWord[]) => {
    const key = `review-${Date.now()}`;
    
    notification.info({
      key,
      message: `有 ${words.length} 个单词需要复习`,
      description: (
        <div>
          <p>根据艾宾浩斯遗忘曲线，以下单词到了复习时间：</p>
          <div className="mt-2 max-h-32 overflow-auto">
            {words.slice(0, 5).map((w) => (
              <div key={w.id} className="text-sm py-1">
                <span className="font-bold">{w.word}</span>
                {w.definitionCn && (
                  <span className="text-gray-500 ml-2">{w.definitionCn.substring(0, 30)}...</span>
                )}
              </div>
            ))}
            {words.length > 5 && (
              <div className="text-sm text-gray-500">还有 {words.length - 5} 个...</div>
            )}
          </div>
        </div>
      ),
      icon: <BookOutlined style={{ color: '#1890ff' }} />,
      duration: 10,
      btn: (
        <Button type="primary" size="small" onClick={() => {
          notification.destroy(key);
          // 跳转到单词本页面
          window.dispatchEvent(new CustomEvent('navigate', { detail: '/wordbook' }));
        }}>
          去复习
        </Button>
      ),
    });
  };

  if (pendingReviews.length === 0) {
    return null;
  }

  return (
    <Badge count={pendingReviews.length} size="small">
      <Button
        type="text"
        icon={<BellOutlined />}
        onClick={() => showReviewNotification(pendingReviews)}
        title="复习提醒"
      />
    </Badge>
  );
};

export default ReviewReminder;
