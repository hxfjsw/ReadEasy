import React, { useState, useEffect } from 'react';
import { Card, Form, Select, Slider, Input, Button, Tabs, message, InputNumber, Space, Table, Popconfirm, Switch, Collapse, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';
import { useSettingsStore } from '../stores/settingsStore';
import { VocabularyLevelLabels, AIConfig } from '../types';

const { TabPane } = Tabs;
const { Option } = Select;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [testLoading, setTestLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [showAIForm, setShowAIForm] = useState(false);

  const {
    vocabularyLevel,
    fontSize,
    fontFamily,
    lineHeight,
    theme,
    highlightColor,
    aiConfigs,
    setVocabularyLevel,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setTheme,
    setHighlightColor,
    addAIConfig,
    updateAIConfig,
    deleteAIConfig,
    loadAIConfigs,
  } = useSettingsStore();

  useEffect(() => {
    form.setFieldsValue({
      vocabularyLevel,
      fontSize,
      fontFamily,
      lineHeight,
      theme,
      highlightColor,
    });
  }, [vocabularyLevel, fontSize, fontFamily, lineHeight, theme, highlightColor, form]);

  const handleSaveSettings = async (values: any) => {
    try {
      await setVocabularyLevel(values.vocabularyLevel);
      await setFontSize(values.fontSize);
      await setFontFamily(values.fontFamily);
      await setLineHeight(values.lineHeight);
      await setTheme(values.theme);
      await setHighlightColor(values.highlightColor);
      message.success('设置已保存');
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleTestConnection = async () => {
    const values = aiForm.getFieldsValue();
    if (!values.baseUrl || !values.apiKey || !values.model) {
      message.warning('请填写完整的配置信息');
      return;
    }

    setTestLoading(true);
    try {
      const result = await (window.electron.ipcRenderer.invoke as any)('ai:testConnection', {
        provider: values.provider,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        model: values.model,
        temperature: values.temperature || 0.3,
        maxTokens: values.maxTokens || 2000,
      });

      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('测试连接失败');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSaveAIConfig = async (values: any) => {
    try {
      const config: AIConfig = {
        provider: values.provider,
        name: values.name,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        model: values.model,
        temperature: values.temperature || 0.3,
        maxTokens: values.maxTokens || 2000,
        isDefault: values.isDefault,
        sourceLanguage: values.sourceLanguage || 'en',
        targetLanguage: values.targetLanguage || 'zh-CN',
        customPrompt: values.customPrompt,
      };

      if (editingConfig?.id) {
        await updateAIConfig(editingConfig.id, config);
        message.success('配置已更新');
      } else {
        await addAIConfig(config);
        message.success('配置已添加');
      }

      setShowAIForm(false);
      setEditingConfig(null);
      aiForm.resetFields();
      await loadAIConfigs();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleEditConfig = (config: AIConfig) => {
    setEditingConfig(config);
    aiForm.setFieldsValue({
      provider: config.provider,
      name: config.name,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      isDefault: config.isDefault,
      sourceLanguage: config.sourceLanguage || 'en',
      targetLanguage: config.targetLanguage || 'zh-CN',
      customPrompt: config.customPrompt,
    });
    setShowAIForm(true);
  };

  const handleDeleteConfig = async (id: number) => {
    try {
      await deleteAIConfig(id);
      message.success('配置已删除');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const aiColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => ({
        openai: 'OpenAI',
        'openai-compatible': 'OpenAI Compatible',
        azure: 'Azure OpenAI',
        anthropic: 'Anthropic',
        custom: '自定义',
      }[provider] || provider),
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: '默认',
      dataIndex: 'isDefault',
      key: 'isDefault',
      render: (isDefault: boolean) => isDefault ? <CheckOutlined style={{ color: '#52c41a' }} /> : null,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AIConfig) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditConfig(record)}
          />
          <Popconfirm
            title="确定删除这个配置吗？"
            onConfirm={() => record.id && handleDeleteConfig(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">设置</h1>

      <Tabs defaultActiveKey="general">
        <TabPane tab="通用设置" key="general">
          <Card title="阅读设置" className="mb-4">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={{
                vocabularyLevel,
                fontSize,
                fontFamily,
                lineHeight,
                theme,
                highlightColor,
              }}
            >
              <Form.Item
                label="词汇水平"
                name="vocabularyLevel"
                help="系统将根据此设置自动识别生词"
              >
                <Select>
                  {Object.entries(VocabularyLevelLabels).map(([value, label]) => (
                    <Option key={value} value={value}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="字体大小"
                name="fontSize"
              >
                <Slider min={12} max={24} marks={{ 12: '12px', 16: '16px', 20: '20px', 24: '24px' }} />
              </Form.Item>

              <Form.Item
                label="字体"
                name="fontFamily"
              >
                <Select>
                  <Option value="Georgia, serif">Georgia</Option>
                  <Option value="'Times New Roman', serif">Times New Roman</Option>
                  <Option value="Arial, sans-serif">Arial</Option>
                  <Option value="'Segoe UI', sans-serif">Segoe UI</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="行高"
                name="lineHeight"
              >
                <Slider min={1.2} max={2.5} step={0.1} marks={{ 1.2: '1.2', 1.8: '1.8', 2.5: '2.5' }} />
              </Form.Item>

              <Form.Item
                label="主题"
                name="theme"
              >
                <Select>
                  <Option value="light">浅色</Option>
                  <Option value="dark">深色</Option>
                  <Option value="sepia">护眼</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="高亮颜色"
                name="highlightColor"
              >
                <Input type="color" style={{ width: 100, height: 32 }} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit">
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="AI 配置" key="ai">
          <Card
            title="AI 服务配置"
            extra={
              !showAIForm && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingConfig(null);
                    aiForm.resetFields();
                    setShowAIForm(true);
                  }}
                >
                  添加配置
                </Button>
              )
            }
          >
            {showAIForm ? (
              <Form
                form={aiForm}
                layout="vertical"
                onFinish={handleSaveAIConfig}
              >
                <Form.Item
                  label="配置名称"
                  name="name"
                  rules={[{ required: true, message: '请输入配置名称' }]}
                >
                  <Input placeholder="例如：OpenAI 配置" />
                </Form.Item>

                <Form.Item
                  label="提供商"
                  name="provider"
                  rules={[{ required: true }]}
                  initialValue="openai"
                >
                  <Select>
                    <Option value="openai">OpenAI</Option>
                    <Option value="openai-compatible">OpenAI Compatible (第三方兼容接口)</Option>
                    <Option value="azure">Azure OpenAI</Option>
                    <Option value="anthropic">Anthropic</Option>
                    <Option value="custom">自定义</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="API Base URL"
                  name="baseUrl"
                  rules={[{ required: true, message: '请输入 API Base URL' }]}
                  initialValue="https://api.openai.com/v1"
                >
                  <Input placeholder="https://api.openai.com/v1" />
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name="apiKey"
                  rules={[{ required: true, message: '请输入 API Key' }]}
                >
                  <Input.Password placeholder="sk-..." />
                </Form.Item>

                <Form.Item
                  label="模型"
                  name="model"
                  rules={[{ required: true, message: '请输入模型名称' }]}
                  initialValue="gpt-3.5-turbo"
                >
                  <Input placeholder="gpt-3.5-turbo" />
                </Form.Item>

                <Form.Item
                  label="Temperature"
                  name="temperature"
                  initialValue={0.3}
                >
                  <Slider min={0} max={1} step={0.1} />
                </Form.Item>

                <Form.Item
                  label="Max Tokens"
                  name="maxTokens"
                  initialValue={2000}
                >
                  <InputNumber min={100} max={8000} step={100} />
                </Form.Item>

                <Collapse ghost className="mb-4">
                  <Collapse.Panel header="翻译设置（可选）" key="translation">
                    <Space direction="vertical" className="w-full">
                      <Form.Item
                        label="来源语言"
                        name="sourceLanguage"
                        initialValue="en"
                        className="mb-2"
                      >
                        <Select placeholder="选择来源语言">
                          <Option value="en">English (英语)</Option>
                          <Option value="zh-CN">Chinese (中文)</Option>
                          <Option value="ja">Japanese (日语)</Option>
                          <Option value="ko">Korean (韩语)</Option>
                          <Option value="fr">French (法语)</Option>
                          <Option value="de">German (德语)</Option>
                          <Option value="es">Spanish (西班牙语)</Option>
                          <Option value="ru">Russian (俄语)</Option>
                        </Select>
                      </Form.Item>

                      <Form.Item
                        label="目标语言"
                        name="targetLanguage"
                        initialValue="zh-CN"
                        className="mb-2"
                      >
                        <Select placeholder="选择目标语言">
                          <Option value="zh-CN">Chinese (中文)</Option>
                          <Option value="en">English (英语)</Option>
                          <Option value="ja">Japanese (日语)</Option>
                          <Option value="ko">Korean (韩语)</Option>
                          <Option value="fr">French (法语)</Option>
                          <Option value="de">German (德语)</Option>
                          <Option value="es">Spanish (西班牙语)</Option>
                          <Option value="ru">Russian (俄语)</Option>
                        </Select>
                      </Form.Item>

                      <Form.Item
                        label="自定义提示词"
                        name="customPrompt"
                        className="mb-2"
                        extra={
                          <div className="text-xs text-gray-500 mt-1">
                            可用变量：
                            <Tag>{'{{'}text{'}}'}</Tag>
                            <Tag>{'{{'}sourceLanguage{'}}'}</Tag>
                            <Tag>{'{{'}targetLanguage{'}}'}</Tag>
                          </div>
                        }
                      >
                        <Input.TextArea
                          rows={4}
                          placeholder={`Translate the following {{sourceLanguage}} text to {{targetLanguage}}:

{{text}}`}
                        />
                      </Form.Item>
                    </Space>
                  </Collapse.Panel>
                </Collapse>

                <Form.Item
                  label="设为默认"
                  name="isDefault"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      保存
                    </Button>
                    <Button onClick={handleTestConnection} loading={testLoading}>
                      测试连接
                    </Button>
                    <Button onClick={() => setShowAIForm(false)}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            ) : (
              <Table
                dataSource={aiConfigs}
                columns={aiColumns}
                rowKey="id"
                pagination={false}
              />
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
