import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleTranslationService } from './index';

describe('GoogleTranslationService', () => {
  let service: GoogleTranslationService;

  beforeEach(() => {
    service = new GoogleTranslationService();
  });

  describe('translate', () => {
    it('应该成功翻译简单文本', async () => {
      const result = await service.translate({
        text: 'Hello',
        targetLang: 'zh-CN',
      });

      expect(result.translatedText).toBeDefined();
      expect(result.translatedText.length).toBeGreaterThan(0);
    });

    it('应该支持自动检测源语言', async () => {
      const result = await service.translate({
        text: 'Hello World',
        targetLang: 'zh-CN',
        sourceLang: 'auto',
      });

      expect(result.translatedText).toBeDefined();
      expect(result.detectedSourceLanguage).toBeDefined();
    });

    it('空文本应该返回空字符串', async () => {
      const result = await service.translate({
        text: '',
        targetLang: 'zh-CN',
      });

      expect(result.translatedText).toBe('');
    });

    it('应该支持多语言翻译', async () => {
      const testCases = [
        { text: 'Hello', targetLang: 'zh-CN', expected: '你好' },
        { text: 'Hello', targetLang: 'ja', expected: 'こんにちは' },
        { text: 'Hello', targetLang: 'ko', expected: '안녕하세요' },
      ];

      for (const testCase of testCases) {
        const result = await service.translate({
          text: testCase.text,
          targetLang: testCase.targetLang,
        });
        expect(result.translatedText).toContain(testCase.expected);
      }
    });

    it('长文本应该被正确翻译', async () => {
      const longText = 'This is a longer text that should still be translated correctly by the Google Translate API.';
      
      const result = await service.translate({
        text: longText,
        targetLang: 'zh-CN',
      });

      expect(result.translatedText).toBeDefined();
      expect(result.translatedText.length).toBeGreaterThan(0);
      expect(result.translatedText).not.toBe(longText);
    });
  });

  describe('translateBatch', () => {
    it('应该批量翻译多个文本', async () => {
      const texts = ['Hello', 'World', 'Test'];
      
      const results = await service.translateBatch(texts, 'zh-CN');

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.translatedText).toBeDefined();
        expect(result.translatedText.length).toBeGreaterThan(0);
      });
    });

    it('空数组应该返回空数组', async () => {
      const results = await service.translateBatch([], 'zh-CN');
      expect(results).toEqual([]);
    });
  });

  describe('testConnection', () => {
    it('应该返回成功当服务可用', async () => {
      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('可用');
    });

    it('应该返回失败当网络错误', async () => {
      // 模拟网络错误
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('失败');

      global.fetch = originalFetch;
    });
  });

  describe('错误处理', () => {
    it('应该处理网络超时', async () => {
      // 模拟超时
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(service.translate({ text: 'test', targetLang: 'zh-CN' }))
        .rejects.toThrow();

      global.fetch = originalFetch;
    });

    it('应该处理无效的响应格式', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve('invalid json'),
      });

      const result = await service.translate({ text: 'test', targetLang: 'zh-CN' });
      
      // 应该返回原文作为降级
      expect(result.translatedText).toBe('test');

      global.fetch = originalFetch;
    });
  });
});
