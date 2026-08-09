'use client';

import React, { useState, useMemo } from 'react';
import { Search, Info, Folder, Image as ImageIcon, Music, FileText, Package, ChevronRight } from 'lucide-react';
import { FileItem } from '../lib/api';

interface FilesExplorerTabProps {
  files: FileItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  formatBytes: (bytes: number) => string;
  onSelectFileDetails?: (fileId: number) => void;
}

export default function FilesExplorerTab({
  files,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  formatBytes,
  onSelectFileDetails
}: FilesExplorerTabProps) {
  const [currentPath, setCurrentPath] = useState<string>('');

  const getFileIcon = (file: FileItem) => {
    if (file.category === 'Media') {
      const ext = file.filename.split('.').pop()?.toLowerCase();
      if (ext && ['mp3', 'flac', 'wav', 'm4a', 'ogg'].includes(ext)) {
        return <Music className="w-4 h-4 text-neon-pink" />;
      }
      return <ImageIcon className="w-4 h-4 text-neon-purple" />;
    }
    if (file.category === 'Documents') return <FileText className="w-4 h-4 text-amber-400" />;
    if (file.category === 'Software & Apps') return <Package className="w-4 h-4 text-emerald-400" />;
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  const activePath = currentPath || '/';

  const { folders, directFiles } = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      // Flatten view when searching
      return { folders: [], directFiles: files };
    }

    const folderSet = new Set<string>();
    const fileList: FileItem[] = [];

    files.forEach(file => {
      // Ensure file path starts with activePath
      if (file.file_path.startsWith(activePath)) {
        let remainder = file.file_path.slice(activePath.length);
        if (remainder.startsWith('/')) remainder = remainder.slice(1);
        
        if (!remainder) return;

        const parts = remainder.split('/');
        if (parts.length === 1) {
          fileList.push(file);
        } else {
          folderSet.add(parts[0]);
        }
      }
    });

    return { 
      folders: Array.from(folderSet).sort(), 
      directFiles: fileList 
    };
  }, [files, activePath, searchQuery]);

  const breadcrumbs = useMemo(() => {
    const parts = activePath.split('/').filter(Boolean);
    const crumbs = [{ label: 'Root', path: '/' }];
    let current = '';
    parts.forEach(part => {
      current += '/' + part;
      crumbs.push({ label: part, path: current });
    });
    return crumbs;
  }, [activePath]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-panel rounded-xl p-4">
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs w-full sm:w-80">
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
            className="bg-black/30 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Software & Apps">Software & Apps</option>
            <option value="Media">Media</option>
            <option value="Documents">Documents</option>
            <option value="Archives & Other">Archives & Other</option>
          </select>
        </div>
      </div>

      {/* Breadcrumbs */}
      {!searchQuery && (
        <div className="flex items-center gap-1 text-xs text-gray-400 bg-black/20 px-4 py-2 rounded-lg border border-white/5 overflow-x-auto">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              <button 
                onClick={() => setCurrentPath(crumb.path)}
                className="hover:text-white transition whitespace-nowrap font-medium"
              >
                {crumb.label}
              </button>
              {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600 shrink-0 mx-1" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Files Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/40 border-b border-white/10 text-gray-400 font-medium">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-gray-300">
            {/* Folder Rows */}
            {folders.map(folder => (
              <tr 
                key={folder} 
                onClick={() => setCurrentPath(activePath === '/' ? `/${folder}` : `${activePath}/${folder}`)}
                className="hover:bg-white/5 transition hover:border-l-2 hover:border-neon-blue cursor-pointer group"
              >
                <td className="px-4 py-3 flex items-center gap-3">
                  <Folder className="w-4 h-4 text-neon-blue neon-text shrink-0" />
                  <span className="font-semibold text-gray-200">{folder}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">--</td>
                <td className="px-4 py-3 text-gray-600">--</td>
                <td className="px-4 py-3 text-gray-600">--</td>
                <td className="px-4 py-3 text-right"></td>
              </tr>
            ))}

            {/* File Rows */}
            {directFiles.map((file) => (
              <tr 
                key={file.id} 
                onClick={() => onSelectFileDetails?.(file.id)}
                className="hover:bg-white/5 transition hover:border-l-2 hover:border-neon-pink cursor-pointer group"
              >
                <td className="px-4 py-3 flex items-start gap-3">
                  <div className="pt-0.5 shrink-0">{getFileIcon(file)}</div>
                  <div>
                    <p className="font-semibold text-gray-200">{file.filename}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate max-w-xs xl:max-w-md">{file.file_path}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 bg-blue-500/10 text-neon-blue neon-text border border-white/10 rounded font-medium">
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
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectFileDetails?.(file.id); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                      <Info className="w-4 h-4" /> 
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {folders.length === 0 && directFiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {searchQuery ? 'No files match your search.' : 'No files found in this directory.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
