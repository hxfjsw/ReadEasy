import { describe, it, expect } from 'vitest';
import { VocabularyLevel, VocabularyLevelLabels } from './index';

describe('VocabularyLevel', () => {
  it('应该包含所有等级', () => {
    expect(VocabularyLevel.ELEMENTARY).toBe('elementary');
    expect(VocabularyLevel.MIDDLE).toBe('middle');
    expect(VocabularyLevel.HIGH).toBe('high');
    expect(VocabularyLevel.CET4).toBe('cet4');
    expect(VocabularyLevel.CET6).toBe('cet6');
    expect(VocabularyLevel.POSTGRADUATE).toBe('postgraduate');
    expect(VocabularyLevel.IELTS).toBe('ielts');
    expect(VocabularyLevel.TOEFL).toBe('toefl');
    expect(VocabularyLevel.GRE).toBe('gre');
    expect(VocabularyLevel.TEM8).toBe('tem8');
  });

  it('等级标签应该正确', () => {
    expect(VocabularyLevelLabels[VocabularyLevel.ELEMENTARY]).toBe('小学');
    expect(VocabularyLevelLabels[VocabularyLevel.MIDDLE]).toBe('初中');
    expect(VocabularyLevelLabels[VocabularyLevel.HIGH]).toBe('高中');
    expect(VocabularyLevelLabels[VocabularyLevel.CET4]).toBe('四级');
    expect(VocabularyLevelLabels[VocabularyLevel.CET6]).toBe('六级');
    expect(VocabularyLevelLabels[VocabularyLevel.POSTGRADUATE]).toBe('考研');
    expect(VocabularyLevelLabels[VocabularyLevel.IELTS]).toBe('雅思');
    expect(VocabularyLevelLabels[VocabularyLevel.TOEFL]).toBe('托福');
    expect(VocabularyLevelLabels[VocabularyLevel.GRE]).toBe('GRE');
    expect(VocabularyLevelLabels[VocabularyLevel.TEM8]).toBe('专八');
  });
});
