/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useConfigs } from './hooks/useConfigs';
import { useTargets } from './hooks/useTargets';
import Sidebar from './components/Sidebar';
import ConfigManager from './components/ConfigManager';
import TargetManager from './components/TargetManager';

export default function App() {
  const [activeTab, setActiveTab] = useState<'configs' | 'targets'>('configs');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default to collapsed
  const { configs, addConfig, updateConfig, deleteConfig } = useConfigs();
  const { targets, addTarget, updateTarget, deleteTarget } = useTargets();

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col">
          <div className="w-full flex-1 flex flex-col min-h-0">
            {activeTab === 'configs' && (
              <ConfigManager configs={configs} targets={targets} addConfig={addConfig} updateConfig={updateConfig} deleteConfig={deleteConfig} />
            )}
            {activeTab === 'targets' && (
              <TargetManager targets={targets} addTarget={addTarget} updateTarget={updateTarget} deleteTarget={deleteTarget} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
