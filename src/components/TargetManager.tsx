import { useState, useEffect } from 'react';
import { Plus, Trash2, Server, Monitor, Save, Terminal, Code, Lock, Bookmark, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ExportTarget } from '../types';
import ConfirmModal from './ConfirmModal';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/themes/prism-tomorrow.css';
import TargetIcon from './TargetIcon';

interface TargetManagerProps {
  targets: ExportTarget[];
  addTarget: (target: Omit<ExportTarget, 'id'>) => Promise<ExportTarget>;
  updateTarget: (id: string, target: Omit<ExportTarget, 'id'>) => Promise<ExportTarget>;
  deleteTarget: (id: string) => Promise<void>;
}

export default function TargetManager({ targets, addTarget, updateTarget, deleteTarget }: TargetManagerProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<ExportTarget | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    isRemote: false,
    sshCommand: 'ssh user@remote-host',
    bashScript: 'echo \'export OPENAI_API_KEY="{{apiKey}}"\' >> ~/.bashrc\necho \'export OPENAI_BASE_URL="{{baseUrl}}"\' >> ~/.bashrc',
    saveAsDefaultScript: '',
    restoreDefaultScript: ''
  });

  // Initialize selection
  useEffect(() => {
    if (!isCreating && !selectedTargetId && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    } else if (targets.length === 0 && !isCreating) {
      setIsCreating(true);
    }
  }, [targets, isCreating, selectedTargetId]);

  // Update form data when selection changes
  useEffect(() => {
    if (!isCreating && selectedTargetId) {
      const target = targets.find((t: ExportTarget) => t.id === selectedTargetId);
      if (target) {
        setFormData({
          name: target.name,
          isRemote: target.isRemote,
          sshCommand: target.sshCommand || 'ssh user@remote-host',
          bashScript: target.bashScript,
          saveAsDefaultScript: target.saveAsDefaultScript || '',
          restoreDefaultScript: target.restoreDefaultScript || ''
        });
      }
    }
  }, [selectedTargetId, isCreating, targets]);

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedTargetId(null);
    setFormData({
      name: '',
      isRemote: false,
      sshCommand: 'ssh user@remote-host',
      bashScript: 'echo \'export OPENAI_API_KEY="{{apiKey}}"\' >> ~/.bashrc\necho \'export OPENAI_BASE_URL="{{baseUrl}}"\' >> ~/.bashrc',
      saveAsDefaultScript: '',
      restoreDefaultScript: ''
    });
  };

  const handleSelect = (id: string) => {
    setIsCreating(false);
    setSelectedTargetId(id);
  };

  const selectedTarget = targets.find((t: ExportTarget) => t.id === selectedTargetId);
  const isReadonly = !isCreating && !!selectedTarget?.isBuiltin;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadonly) return;
    if (isCreating) {
      addTarget(formData);
      setIsCreating(false);
    } else if (selectedTargetId) {
      updateTarget(selectedTargetId, formData);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
      <div className="flex-shrink-0">
        <h2 className="text-base font-bold text-gray-900">Import Targets</h2>
        <p className="text-gray-500 text-xs mt-0.5">Manage your import targets. You can deploy to these targets directly from the API Configurations tab.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-auto">
        {/* Left Column: List */}
        <div className="md:col-span-4 lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">Targets</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCreateNew}
              className="p-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              title="Add New Target"
            >
            <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="p-3 flex-1 overflow-y-auto space-y-2">
            {targets.length === 0 && !isCreating ? (
              <div className="text-center py-8 text-gray-500 text-sm">No targets yet.</div>
            ) : (
              targets.map((target: ExportTarget) => (
                <div
                  key={target.id}
                  onClick={() => handleSelect(target.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(target.id); } }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTargetId === target.id && !isCreating
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-md flex-shrink-0 bg-gray-100 flex items-center justify-center">
                      <TargetIcon targetId={target.id} isBuiltin={target.isBuiltin} isRemote={target.isRemote} className="w-6 h-6" />
                    </div>
                    <div className="truncate text-left">
                      <div className={`text-sm font-medium truncate ${selectedTargetId === target.id && !isCreating ? 'text-blue-900' : 'text-gray-900'}`}>
                        {target.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {target.isRemote ? 'Remote' : 'Local'}
                      </div>
                    </div>
                  </div>
                  {target.isBuiltin ? (
                    <span className="p-1.5 text-gray-300 flex-shrink-0" title="Built-in target, cannot delete">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetToDelete(target);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
            {isCreating && (
              <div className="w-full flex items-center p-3 rounded-lg border border-blue-500 bg-blue-50">
                <div className="text-sm font-medium text-blue-700">New Target...</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Editor */}
        <div className="md:col-span-8 lg:col-span-9 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5">
            {isReadonly ? <Lock className="w-3.5 h-3.5 text-gray-400" /> : <Code className="w-3.5 h-3.5 text-blue-600" />}
            <h3 className="text-sm font-semibold text-gray-800">
              {isCreating ? 'Create New Target' : isReadonly ? 'Built-in Target (Read-only)' : 'Edit Target'}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <form id="target-form" onSubmit={handleSave} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">Target Name</label>
                <Input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Cursor (Remote Server)"
                  disabled={isReadonly}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">Host Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${!formData.isRemote ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'} ${isReadonly ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="hostType"
                      checked={!formData.isRemote}
                      onChange={() => setFormData({ ...formData, isRemote: false })}
                      disabled={isReadonly}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <Monitor className={`w-3.5 h-3.5 ${!formData.isRemote ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <div className={`text-xs font-medium ${!formData.isRemote ? 'text-blue-900' : 'text-gray-700'}`}>Local Machine</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${formData.isRemote ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200 hover:bg-gray-50'} ${isReadonly ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="hostType"
                      checked={formData.isRemote}
                      onChange={() => setFormData({ ...formData, isRemote: true })}
                      disabled={isReadonly}
                      className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500"
                    />
                    <Server className={`w-3.5 h-3.5 ${formData.isRemote ? 'text-purple-600' : 'text-gray-400'}`} />
                    <div>
                      <div className={`text-xs font-medium ${formData.isRemote ? 'text-purple-900' : 'text-gray-700'}`}>Remote Server</div>
                    </div>
                  </label>
                </div>
              </div>

              {formData.isRemote && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-semibold text-gray-900 mb-1">SSH Command</label>
                  <Input
                    required={formData.isRemote}
                    type="text"
                    value={formData.sshCommand}
                    onChange={e => setFormData({ ...formData, sshCommand: e.target.value })}
                    placeholder="ssh root@192.168.1.100 -p 2222"
                    className="font-mono text-sm"
                    disabled={isReadonly}
                  />
                </div>
              )}

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-xs font-semibold text-gray-900">Bash Script</label>
                  <div className="flex gap-2">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{apiKey}}'}</code>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{baseUrl}}'}</code>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{models}}'}</code>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-800 shadow-sm bg-[#2d2d2d] flex flex-col">
                  <div className="bg-gray-800 px-3 py-1.5 border-b border-gray-700 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-mono text-gray-400">script.sh</span>
                  </div>
                  <div className="min-h-[200px]">
                    <Editor
                      value={formData.bashScript}
                      onValueChange={code => !isReadonly && setFormData({ ...formData, bashScript: code })}
                      highlight={code => Prism.highlight(code, Prism.languages.bash || {}, 'bash')}
                      padding={16}
                      style={{
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        fontSize: 12,
                        minHeight: '200px',
                        backgroundColor: 'transparent',
                        color: '#f8f8f2',
                        opacity: isReadonly ? 0.7 : 1,
                      }}
                      className="editor-container"
                      textareaClassName="focus:outline-none"
                      readOnly={isReadonly}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-xs font-semibold text-gray-900">Save as Default Script</label>
                  <div className="flex gap-2">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{apiKey}}'}</code>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{baseUrl}}'}</code>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-800 shadow-sm bg-[#2d2d2d] flex flex-col">
                  <div className="bg-gray-800 px-3 py-1.5 border-b border-gray-700 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-mono text-gray-400">save_default.sh</span>
                  </div>
                  <div className="min-h-[120px]">
                    <Editor
                      value={formData.saveAsDefaultScript}
                      onValueChange={code => !isReadonly && setFormData({ ...formData, saveAsDefaultScript: code })}
                      highlight={code => Prism.highlight(code, Prism.languages.bash || {}, 'bash')}
                      padding={16}
                      style={{
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        fontSize: 12,
                        minHeight: '120px',
                        backgroundColor: 'transparent',
                        color: '#f8f8f2',
                        opacity: isReadonly ? 0.7 : 1,
                      }}
                      className="editor-container"
                      textareaClassName="focus:outline-none"
                      readOnly={isReadonly}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-xs font-semibold text-gray-900">Restore Default Script</label>
                  <div className="flex gap-2">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{apiKey}}'}</code>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{baseUrl}}'}</code>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-800 shadow-sm bg-[#2d2d2d] flex flex-col">
                  <div className="bg-gray-800 px-3 py-1.5 border-b border-gray-700 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-mono text-gray-400">restore_default.sh</span>
                  </div>
                  <div className="min-h-[120px]">
                    <Editor
                      value={formData.restoreDefaultScript}
                      onValueChange={code => !isReadonly && setFormData({ ...formData, restoreDefaultScript: code })}
                      highlight={code => Prism.highlight(code, Prism.languages.bash || {}, 'bash')}
                      padding={16}
                      style={{
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        fontSize: 12,
                        minHeight: '120px',
                        backgroundColor: 'transparent',
                        color: '#f8f8f2',
                        opacity: isReadonly ? 0.7 : 1,
                      }}
                      className="editor-container"
                      textareaClassName="focus:outline-none"
                      readOnly={isReadonly}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end">
            <Button type="submit" form="target-form" size="sm" disabled={isReadonly}>
              <Save className="w-3.5 h-3.5" />
              {isCreating ? 'Save New Target' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {targetToDelete && (
        <ConfirmModal
          title="Delete Target"
          message={`Are you sure you want to delete the import target "${targetToDelete.name}"? This action cannot be undone.`}
          onConfirm={() => {
            deleteTarget(targetToDelete.id);
            setTargetToDelete(null);
            if (selectedTargetId === targetToDelete.id) {
              setSelectedTargetId(null);
            }
          }}
          onCancel={() => setTargetToDelete(null)}
        />
      )}
    </div>
  );
}
