'use client';

import React from 'react';
import { Search, MessageSquare, Sparkles, Info } from 'lucide-react';
import { FileItem } from '../lib/api';

interface FilesExplorerTabProps {
  files: FileItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  formatBytes: (bytes: number) => string;
  onAddPathToChat: (filename: string, fullPath: string) => void;
  onSendChatCommand: (prompt: string) => void;
  onSelectFileDetails?: (fileId: number) => void;
}

export default function FilesExplorerTab({
  files,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  formatBytes,
  onAddPathToChat,
  onSendChatCommand,
  onSelectFileDetails
}: FilesExplorerTabProps) {
  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#131b2e] border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 bg-[#0b0f19] border border-gray-800 rounded-lg px-3 py-2 text-xs w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename..."
            className="bg-transparent text-gray-200 outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#0b0f19] border border-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Software & Apps">Software & Apps</option>
            <option value="Media">Media</option>
            <option value="Documents">Documents</option>
            <option value="Archives & Other">Archives & Other</option>
          </select>
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-[#131b2e] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0d1322] border-b border-gray-800 text-gray-400 font-medium">
            <tr>
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-gray-300">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-gray-800/30 transition">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-200">{file.filename}</p>
                  <p className="text-[11px] text-gray-500 font-mono">{file.file_path}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded font-medium">
                    {file.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{formatBytes(file.file_size)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                    file.status === 'action_pending' ? 'bg-indigo-500/20 text-indigo-300' :
                    file.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-gray-800 text-gray-300'
                  }`}>
                    {file.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {onSelectFileDetails && (
                      <button
                        onClick={() => onSelectFileDetails(file.id)}
                        className="bg-[#0b0f19] hover:bg-gray-800 text-gray-200 border border-gray-700 font-medium px-2.5 py-1 rounded transition text-[11px] flex items-center gap-1"
                        title="View Metadata & Image Preview Modal"
                      >
                        <Info className="w-3 h-3 text-indigo-400" /> Details
                      </button>
                    )}
                    <button
                      onClick={() => onAddPathToChat(file.filename, file.file_path)}
                      className="bg-[#0b0f19] hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 font-medium px-2.5 py-1 rounded transition text-[11px] flex items-center gap-1"
                      title="Ask AI questions about metadata, album, or director"
                    >
                      <MessageSquare className="w-3 h-3 text-indigo-400" /> Ask AI
                    </button>
                    <button
                      onClick={() => onSendChatCommand(`Move ${file.filename} to webserver/audio`)}
                      className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-medium px-2.5 py-1 rounded transition text-[11px] flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" /> Organize
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No files found. Scan a NAS directory to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
