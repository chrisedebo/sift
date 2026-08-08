'use client';

import React from 'react';
import { Sparkles, Database, FolderSearch, Layers, Settings as SettingsIcon, Server, Globe } from 'lucide-react';
import { HealthResponse } from '../lib/api';

interface SidebarProps {
  activeTab: 'dashboard' | 'explorer' | 'queue' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'explorer' | 'queue' | 'settings') => void;
  totalFiles: number;
  pendingQueueCount: number;
  health: HealthResponse | null;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  totalFiles,
  pendingQueueCount,
  health
}: SidebarProps) {
  return (
    <aside className="w-64 bg-[#0d1322] border-r border-gray-800 flex flex-col justify-between p-4 shrink-0">
      <div>
        {/* Logo Header */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-gray-800/60">
          <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">sift</h1>
            <p className="text-xs text-indigo-400 font-medium">NAS Media & File AI</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <Database className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'explorer'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <FolderSearch className="w-4 h-4" />
            Files Explorer
            <span className="ml-auto text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-300">
              {totalFiles}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'queue'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Approval Queue
            {pendingQueueCount > 0 && (
              <span className="ml-auto text-xs bg-indigo-500 text-white font-bold px-2 py-0.5 rounded-full">
                {pendingQueueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'settings'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>
        </nav>
      </div>

      {/* Footer Status Indicators */}
      <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-400">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            LM Studio:
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            health?.lm_studio?.status === 'healthy' 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {health?.lm_studio?.status || 'checking...'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-400">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            SearXNG:
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            health?.searxng?.status === 'healthy'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {health?.searxng?.status || 'checking...'}
          </span>
        </div>
      </div>
    </aside>
  );
}
