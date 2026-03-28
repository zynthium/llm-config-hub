import { Database, Target, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './ui/Button';

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  toggleCollapse,
}: { activeTab: string; setActiveTab: (tab: 'configs' | 'targets') => void; isCollapsed: boolean; toggleCollapse: () => void }) {
  return (
    <div
      className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16 items-center' : 'w-[200px]'}`}
    >
      <div className={`p-4 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
        <img src="/icon.png" alt="LLM Config Hub" className="w-9 h-9 rounded-md flex-shrink-0 object-contain" />
        {!isCollapsed && (
          <h1 className="text-sm font-bold text-gray-800 truncate">LLM Config Hub</h1>
        )}
      </div>
      <nav className="flex-1 py-3 space-y-1">
        <Button
          variant="ghost"
          onClick={() => setActiveTab('configs')}
          className={`w-full flex items-center justify-start gap-2 px-4 py-2 text-xs font-medium rounded-none ${
            activeTab === 'configs' ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Database className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && 'API Configurations'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab('targets')}
          className={`w-full flex items-center justify-start gap-2 px-4 py-2 text-xs font-medium rounded-none ${
            activeTab === 'targets' ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Target className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && 'Import Targets'}
        </Button>
      </nav>
      <div className={`p-3 border-t border-gray-200 ${isCollapsed ? 'flex justify-center' : 'flex justify-end'}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
