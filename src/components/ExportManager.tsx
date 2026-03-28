import { useState } from 'react';
import { Copy, Check, Terminal, Code, MessageSquare, Bot } from 'lucide-react';
import { Button } from './ui/Button';
import { LLMConfig } from '../types';

const TOOLS = [
  { id: 'env', name: 'Global Env (.bashrc/.zshrc)', icon: Terminal },
  { id: 'python', name: 'Python (OpenAI SDK)', icon: Code },
  { id: 'curl', name: 'cURL Request', icon: Terminal },
  { id: 'nextchat', name: 'NextChat', icon: MessageSquare },
  { id: 'lobechat', name: 'LobeChat', icon: Bot },
];

export default function ExportManager({ configs }: { configs: LLMConfig[] }) {
  const [selectedConfigId, setSelectedConfigId] = useState<string>(configs[0]?.id || '');
  const [selectedTool, setSelectedTool] = useState<string>('env');
  const [copied, setCopied] = useState(false);

  const selectedConfig = configs.find(c => c.id === selectedConfigId);

  const generateSnippet = () => {
    if (!selectedConfig) return '';

    const { baseUrl, apiKey, models } = selectedConfig;

    switch (selectedTool) {
      case 'env':
        return `export OPENAI_BASE_URL="${baseUrl}"\nexport OPENAI_API_KEY="${apiKey}"${models ? `\nexport CUSTOM_MODELS="${models}"` : ''}`;
      
      case 'python':
        return `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}",\n    api_key="${apiKey}"\n)\n\nresponse = client.chat.completions.create(\n    model="${models ? models.split(',')[0].trim() : 'gpt-3.5-turbo'}",\n    messages=[{"role": "user", "content": "Hello!"}]\n)\nprint(response.choices[0].message.content)`;
      
      case 'curl':
        return `curl ${baseUrl}/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -d '{\n    "model": "${models ? models.split(',')[0].trim() : 'gpt-3.5-turbo'}",\n    "messages": [{"role": "user", "content": "Hello!"}]\n  }'`;
      
      case 'nextchat':
        return `BASE_URL=${baseUrl}\nOPENAI_API_KEY=${apiKey}\nCUSTOM_MODELS=${models || '-all,+gpt-3.5-turbo,+gpt-4'}`;
      
      case 'lobechat':
        return `OPENAI_PROXY_URL=${baseUrl}\nOPENAI_API_KEY=${apiKey}\nCUSTOM_MODELS=${models || ''}`;
      
      default:
        return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (configs.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Export & Integration</h2>
        <p className="text-gray-500">Please add a configuration first to generate export snippets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Export & Integration</h2>
        <p className="text-gray-500 text-sm mt-1">Generate snippets for your favorite AI tools and SDKs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">1. Select Configuration</h3>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
              {configs.map(config => (
                <Button
                  key={config.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedConfigId(config.id)}
                  className={`w-full text-left rounded-md border ${
                    selectedConfigId === config.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{config.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{config.provider}</div>
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">2. Select Target Tool</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {TOOLS.map(tool => {
                const Icon = tool.icon;
                return (
                  <Button
                    key={tool.id}
                    variant="ghost"
                    onClick={() => setSelectedTool(tool.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${
                      selectedTool === tool.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tool.name}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden flex flex-col h-full min-h-[400px]">
            <div className="flex justify-between items-center px-4 py-3 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-2 text-xs font-mono text-gray-400">
                  {TOOLS.find(t => t.id === selectedTool)?.name} Snippet
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="text-gray-200 hover:text-white hover:bg-gray-600 text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-all">
                {generateSnippet()}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
