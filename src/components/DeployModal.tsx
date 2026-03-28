import { useState } from 'react';
import { X, Copy, Check, Server, Monitor, Play, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/Button';
import { LLMConfig, ExportTarget } from '../types';

export default function DeployModal({ config, targets, onClose }: { config: LLMConfig, targets: ExportTarget[], onClose: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmTarget, setConfirmTarget] = useState<ExportTarget | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const getSnippet = (target: ExportTarget) => {
    const { baseUrl, apiKey, models, defaultModel } = config;
    let script = target.bashScript
      .replace(/\{\{apiKey\}\}/g, apiKey)
      .replace(/\{\{baseUrl\}\}/g, baseUrl)
      .replace(/\{\{models\}\}/g, models || '');
    script = script.replace(/\{\{defaultModel\}\}/g, defaultModel || '');

    if (target.isRemote && target.sshCommand) {
      const escapedScript = script.replace(/'/g, "'\\''" );
      return `${target.sshCommand} '${escapedScript}'`;
    }
    return script;
  };

  const handleCopy = (target: ExportTarget) => {
    navigator.clipboard.writeText(getSnippet(target));
    setCopiedId(target.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRun = async (target: ExportTarget) => {
    setConfirmTarget(null);
    setRunningId(target.id);
    setRunResult(prev => { const next = { ...prev }; delete next[target.id]; return next; });
    try {
      const output = await invoke<string>('run_bash_script', { script: getSnippet(target) });
      setRunResult(prev => ({ ...prev, [target.id]: { ok: true, message: output || '执行成功' } }));
    } catch (err) {
      setRunResult(prev => ({ ...prev, [target.id]: { ok: false, message: String(err) } }));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Deploy Configuration</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Generate deployment commands for{' '}
              <span className="font-medium text-gray-700">{config.name}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-gray-600 h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {targets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-gray-500">No import targets available.</p>
              <p className="text-xs text-gray-400 mt-1">Please add targets in the "Import Targets" tab first.</p>
            </div>
          ) : (
            targets.map(target => (
              <div key={target.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">

                {/* Target header */}
                <div className="flex justify-between items-center px-3 py-2 bg-white">
                  <button
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => toggleExpand(target.id)}
                  >
                    {expandedIds[target.id]
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    <div className={`p-1.5 rounded-md flex-shrink-0 ${target.isRemote ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                      {target.isRemote ? <Server className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-left min-w-0">
                      <h3 className="text-xs font-semibold text-gray-900">{target.name}</h3>
                      <span className={`text-xs ${target.isRemote ? 'text-purple-500' : 'text-green-500'}`}>
                        {target.isRemote ? 'Remote (SSH)' : 'Local Machine'}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(target)}
                      className={copiedId === target.id
                        ? 'border-green-300 text-green-600 hover:bg-green-50'
                        : 'border-blue-200 text-blue-600 hover:bg-blue-50'}
                    >
                      {copiedId === target.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === target.id ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmTarget(target)}
                      disabled={runningId === target.id}
                      className="border-orange-200 text-orange-600 hover:bg-orange-50"
                    >
                      {runningId === target.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Play className="w-3.5 h-3.5" />}
                      Run
                    </Button>
                  </div>
                </div>

                {/* Run result */}
                {runResult[target.id] && (
                  <div className={`px-3 py-2 flex items-start gap-2 text-xs border-t ${
                    runResult[target.id].ok
                      ? 'bg-green-50 border-green-100 text-green-700'
                      : 'bg-red-50 border-red-100 text-red-700'
                  }`}>
                    {runResult[target.id].ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                    <pre className="font-mono whitespace-pre-wrap break-all">{runResult[target.id].message}</pre>
                  </div>
                )}

                {/* Script block */}
                {expandedIds[target.id] && (
                  <div className="px-3 py-2.5 bg-gray-900 border-t border-gray-700">
                    <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed">
                      {getSnippet(target)}
                    </pre>
                  </div>
                )}

              </div>
            ))
          )}
        </div>

      </div>

      {/* Confirm dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">确认运行脚本</h3>
            <p className="text-xs text-gray-500 mb-4">
              即将在 <span className="font-medium text-gray-700">{confirmTarget.name}</span> 上执行部署脚本，此操作会修改系统环境变量，确认继续？
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmTarget(null)}>取消</Button>
              <Button
                size="sm"
                onClick={() => handleRun(confirmTarget)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Play className="w-3.5 h-3.5" />
                确认运行
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
