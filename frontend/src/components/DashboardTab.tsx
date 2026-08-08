'use client';

import React from 'react';
import { Database, HardDrive, Layers, ShieldCheck, CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import { FileItem, StatsResponse } from '../lib/api';

interface DashboardTabProps {
  stats: StatsResponse | null;
  files: FileItem[];
  pendingQueueCount: number;
  formatBytes: (bytes: number) => string;
  onNavigateExplorer: () => void;
  onAddPathToChat: (filename: string, fullPath: string) => void;
}

export default function DashboardTab({
  stats,
  files,
  pendingQueueCount,
  formatBytes,
  onNavigateExplorer,
  onAddPathToChat
}: DashboardTabProps) {
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Files Indexed</p>
            <p className="text-2xl font-bold text-white mt-1">{stats?.total_files || 0}</p>
          </div>
          <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20 text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Storage Size</p>
            <p className="text-2xl font-bold text-white mt-1">{formatBytes(stats?.total_bytes || 0)}</p>
          </div>
          <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-blue-400">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Pending Approvals</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{pendingQueueCount}</p>
          </div>
          <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/20 text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Safety Engine</p>
            <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Dry-Run Mode
            </p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Indexed Category Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(stats?.categories || {}).map(([cat, count]) => (
            <div key={cat} className="bg-[#0b0f19] border border-gray-800/80 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 truncate">{cat}</p>
              <p className="text-lg font-bold text-indigo-300 mt-0.5">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions & Recent Files */}
      <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Recently Indexed Digital Assets</h3>
          <button onClick={onNavigateExplorer} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-gray-800/60">
          {files.slice(0, 5).map((file) => (
            <div key={file.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-gray-800 text-indigo-300 rounded font-medium">
                  {file.category}
                </span>
                <div>
                  <p className="text-gray-200 font-medium">{file.filename}</p>
                  <p className="text-gray-500 text-[11px] font-mono">{file.file_path}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAddPathToChat(file.filename, file.file_path)}
                  className="bg-[#0b0f19] hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 px-2 py-1 rounded text-[11px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Ask AI
                </button>
                <span className="text-gray-400">{formatBytes(file.file_size)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
