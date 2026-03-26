import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationService, GoogleTranslationService } from './index';

describe('TranslationService', () => {
  let service: TranslationService;
  let mockAIService: any;

  beforeEach(() => {
    mockAIService = {
      translateSentence: vi.fn(),
    };
    service = new TranslationService(mockAIService);
  });

  describe('translate', () => {
    it('默认应该使用Google翻译', async () => {
      const result = await service.translate('Hello');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('应该支持指定使用AI翻译', async () => {
      mockAIService.translateSentence.mockResolvedValue('AI翻译结果');
      
      const result = await service.translate('Hello', 'ai');
      
      expect(result).toBe('AI翻译结果');
      expect(mockAIService.translateSentence).toHaveBeenCalledWith('Hello', undefined);
    });

    it('AI翻译失败应该抛出错误', async () => {
      mockAIService.translateSentence.mockRejectedValue(new Error('API key not configured'));
      
      await expect(service.translate('Hello', 'ai')).rejects.toThrow('API key not configured');
    });

    it('应该支持传入configId进行AI翻译', async () => {
      mockAIService.translateSentence.mockResolvedValue('翻译结果');
      
      await service.translate('Hello', 'ai', 123);
      
      expect(mockAIService.translateSentence).toHaveBeenCalledWith('Hello', 123);
    });
  });

  describe('testConnection', () => {
    it('应该测试Google翻译连接', async () => {
      const result = await service.testConnection('google');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('可用');
    });

    it('AI服务不可用应该返回错误', async () => {
      const serviceWithoutAI = new TranslationService();
      
      const result = await serviceWithoutAI.testConnection('ai');
      
      expect(result.success).toBe(false);
    });
  });

  describe('getGoogleService', () => {
    it('应该返回GoogleTranslationService实例', () => {
      const googleService = service.getGoogleService();
      
      expect(googleService).toBeInstanceOf(GoogleTranslationService);
    });
  });
});

// 降级测试
describe('TranslationService 降级策略', () => {
  it('当Google服务失败时应该抛出错误', async () => {
    const service = new TranslationService();
    const googleService = service.getGoogleService();
    
    // 模拟Google服务失败
    vi.spyOn(googleService, 'translate').mockRejectedValue(new Error('Network error'));
    
    await expect(service.translate('Hello')).rejects.toThrow('Network error');
  });
});
