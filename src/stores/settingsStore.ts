import { create } from 'zustand';
import { VocabularyLevel, AIConfig, UserSettings } from '../types';

interface SettingsState extends UserSettings {
  aiConfigs: AIConfig[];
  defaultAIConfig?: AIConfig;
  initialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  setVocabularyLevel: (level: VocabularyLevel) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setLineHeight: (height: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'sepia') => void;
  setHighlightColor: (color: string) => void;
  addCustomWords: (words: string[]) => void;
  removeCustomWord: (word: string) => void;
  loadAIConfigs: () => Promise<void>;
  addAIConfig: (config: AIConfig) => Promise<void>;
  updateAIConfig: (id: number, config: Partial<AIConfig>) => Promise<void>;
  deleteAIConfig: (id: number) => Promise<void>;
  saveSettings: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  vocabularyLevel: VocabularyLevel.CET4,
  customWords: [],
  fontSize: 16,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.8,
  theme: 'light',
  highlightColor: '#ffeb3b',
};

// Helper for IPC calls
const ipcInvoke = (channel: string, ...args: any[]) => {
  return (window.electron.ipcRenderer.invoke as any)(channel, ...args);
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  aiConfigs: [],
  initialized: false,

  initialize: async () => {
    try {
      // 加载用户设置
      const user = await ipcInvoke('db:getUser');
      if (user) {
        const settings = JSON.parse(user.settings || '{}');
        set({
          vocabularyLevel: user.vocabularyLevel || VocabularyLevel.CET4,
          customWords: JSON.parse(user.customWords || '[]'),
          fontSize: settings.fontSize || 16,
          fontFamily: settings.fontFamily || 'Georgia, serif',
          lineHeight: settings.lineHeight || 1.8,
          theme: settings.theme || 'light',
          highlightColor: settings.highlightColor || '#ffeb3b',
        });
      }

      // 加载AI配置
      await get().loadAIConfigs();

      set({ initialized: true });
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      set({ initialized: true });
    }
  },

  setVocabularyLevel: async (level) => {
    set({ vocabularyLevel: level });
    const user = await ipcInvoke('db:getUser');
    if (user) {
      await ipcInvoke('db:updateUser', user.id, {
        vocabularyLevel: level,
      });
    }
  },

  setFontSize: async (size) => {
    set({ fontSize: size });
    await get().saveSettings();
  },

  setFontFamily: async (family) => {
    set({ fontFamily: family });
    await get().saveSettings();
  },

  setLineHeight: async (height) => {
    set({ lineHeight: height });
    await get().saveSettings();
  },

  setTheme: async (theme) => {
    set({ theme });
    await get().saveSettings();
  },

  setHighlightColor: async (color) => {
    set({ highlightColor: color });
    await get().saveSettings();
  },

  addCustomWords: async (words) => {
    const currentWords = get().customWords;
    const newWords = [...new Set([...currentWords, ...words])];
    set({ customWords: newWords });
    
    const user = await ipcInvoke('db:getUser');
    if (user) {
      await ipcInvoke('db:updateUser', user.id, {
        customWords: JSON.stringify(newWords),
      });
    }
  },

  removeCustomWord: async (word) => {
    const currentWords = get().customWords;
    const newWords = currentWords.filter((w) => w !== word);
    set({ customWords: newWords });
    
    const user = await ipcInvoke('db:getUser');
    if (user) {
      await ipcInvoke('db:updateUser', user.id, {
        customWords: JSON.stringify(newWords),
      });
    }
  },

  loadAIConfigs: async () => {
    try {
      const configs = await ipcInvoke('db:getAIConfigs');
      const defaultConfig = await ipcInvoke('db:getDefaultAIConfig');
      set({ 
        aiConfigs: configs || [],
        defaultAIConfig: defaultConfig,
      });
    } catch (error) {
      console.error('Failed to load AI configs:', error);
    }
  },

  addAIConfig: async (config) => {
    const id = await ipcInvoke('db:addAIConfig', config);
    await get().loadAIConfigs();
    return id;
  },

  updateAIConfig: async (id, config) => {
    await ipcInvoke('db:updateAIConfig', id, config);
    await get().loadAIConfigs();
  },

  deleteAIConfig: async (id) => {
    await ipcInvoke('db:deleteAIConfig', id);
    await get().loadAIConfigs();
  },

  saveSettings: async () => {
    const user = await ipcInvoke('db:getUser');
    if (user) {
      const { fontSize, fontFamily, lineHeight, theme, highlightColor } = get();
      await ipcInvoke('db:updateUser', user.id, {
        settings: JSON.stringify({ fontSize, fontFamily, lineHeight, theme, highlightColor }),
      });
    }
  },
}));
