'use client';

import React from 'react';
import { HardDrive, RefreshCw, Bot } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'explorer' | 'queue' | 'settings';
  scanPath: string;
  setScanPath: (path: string) => void;
  isScanning: boolean;
  onScan: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}

export default function Header({
  activeTab,
  scanPath,
  setScanPath,
  isScanning,
  onScan,
  isChatOpen,
  setIsChatOpen
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-white/10 glass-panel px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-gray-300">
          {activeTab === 'dashboard' && 'Dashboard Overview'}
          {activeTab === 'explorer' && 'Indexed Files Explorer'}
          {activeTab === 'queue' && 'Dry-Run Execution Queue'}
          {activeTab === 'settings' && 'System & Provider Config'}
        </span>

        {/* Target Path Scanner Input */}
        <div className="flex items-center gap-2 glass-panel rounded-lg px-3 py-1.5 text-xs">
          <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
          <input
            type="text"
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            className="bg-transparent text-gray-200 outline-none w-72 font-mono"
            placeholder="/mnt/big-storage"
          />
          <button
            onClick={onScan}
            disabled={isScanning}
            className="futuristic-btn active text-white font-medium px-2.5 py-1 rounded transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="futuristic-btn text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 text-white"
        >
          <Bot className="w-4 h-4 text-neon-blue" />
          {isChatOpen ? 'Hide AI Chat' : 'Open AI Chat Assistant'}
        </button>
      </div>
    </header>
  );
}
