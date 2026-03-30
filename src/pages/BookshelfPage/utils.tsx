import { FileTextOutlined, FileUnknownOutlined } from '@ant-design/icons';
import { verb, noun, adjective } from 'wink-lemmatizer';

// 辅助函数：尝试将单词还原为原型
export const lemmatizeWord = (word: string): string => {
  const verbForm = verb(word);
  if (verbForm !== word) return verbForm;
  
  const nounForm = noun(word);
  if (nounForm !== word) return nounForm;
  
  const adjForm = adjective(word);
  if (adjForm !== word) return adjForm;
  
  return word;
};

// 解析日期
export const parseDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  if (typeof dateValue === 'number') {
    return dateValue < 1e10 ? new Date(dateValue * 1000) : new Date(dateValue);
  }
  return new Date(dateValue);
};

// 格式化时间
export const formatTime = (date: Date | number | string): string => {
  const parsedDate = parseDate(date);
  const now = new Date();
  const diff = now.getTime() - parsedDate.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 0 ? '刚刚' : `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return parsedDate.toLocaleDateString('zh-CN');
  }
};

// 获取文件图标
export const getFileIcon = (format: string) => {
  const ext = format.toLowerCase();
  const style = { fontSize: 48 };
  if (ext === 'epub') {
    return <FileTextOutlined style={{ ...style, color: '#52c41a' }} />;
  } else if (ext === 'txt') {
    return <FileTextOutlined style={{ ...style, color: '#1890ff' }} />;
  } else if (ext === 'mobi') {
    return <FileTextOutlined style={{ ...style, color: '#722ed1' }} />;
  }
  return <FileUnknownOutlined style={{ ...style, color: '#8c8c8c' }} />;
};

// 检查是否是重复字母（如 aaaa, bbbb）
const isRepeatedChar = (word: string): boolean => {
  if (word.length < 2) return false;
  const firstChar = word[0];
  for (let i = 1; i < word.length; i++) {
    if (word[i] !== firstChar) return false;
  }
  return true;
};

// 从文本中提取单词和例句
export const extractWordsFromText = (text: string): Map<string, { count: number; example?: string }> => {
  const wordData = new Map<string, { count: number; example?: string }>();
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const matches = text.match(/[a-zA-Z]{4,}/g);
  
  if (matches) {
    matches.forEach(word => {
      const lowerWord = word.toLowerCase();
      // 过滤纯重复字母和常见无意义组合，且长度在4-20之间
      if (!isRepeatedChar(lowerWord) && lowerWord.length >= 4 && lowerWord.length <= 20) {
        const lemma = lemmatizeWord(lowerWord);
        
        const existing = wordData.get(lemma);
        if (existing) {
          existing.count++;
        } else {
          let example: string | undefined;
          for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(lowerWord)) {
              example = sentence.trim().replace(/\s+/g, ' ');
              if (example.length > 120) {
                example = example.slice(0, 120) + '...';
              }
              break;
            }
          }
          wordData.set(lemma, { count: 1, example });
        }
      }
    });
  }
  return wordData;
};
