'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Info, Folder, Image as ImageIcon, Music, FileText, Package, ChevronRight, ChevronDown } from 'lucide-react';
import { FileItem, DirectoryContentsResponse } from '../lib/api';

interface FilesExplorerTabProps {
  files: FileItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  formatBytes: (bytes: number) => string;
  onSelectFileDetails?: (fileId: number) => void;
  onAddPathToChat?: (filename: string, fullPath: string) => void;
}

interface CachedDir {
  folders: string[];
  files: FileItem[];
}

export default function FilesExplorerTab({
  files,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  formatBytes,
  onSelectFileDetails,
  onAddPathToChat,
}: FilesExplorerTabProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dirCache, setDirCache] = useState<Map<string, CachedDir>>(new Map());
  const [isLoadingDir, setIsLoadingDir] = useState(false);

  // Normalize the current path to always start with / and not end with /
  const normalizePath = (p: string): string => {
    if (!p || p === '/') return '/';
    let normalized = p;
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  };

  const activePath = normalizePath(currentPath);

  // Toggle folder expansion
  const toggleFolder = (folderName: string, path: string) => {
    const key = path;
    const next = new Set(expandedFolders);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedFolders(next);
  };

  // Navigate into a folder
  const navigateToFolder = (folderName: string, parentPath: string) => {
    const newPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;
    setCurrentPath(newPath);
    // Auto-expand for tree view
    const key = parentPath;
    const next = new Set(expandedFolders);
    next.add(key);
    setExpandedFolders(next);
  };

  // Fetch directory contents from backend API
  const fetchDirContents = async (path: string) => {
    if (dirCache.has(path)) return dirCache.get(path);

    setIsLoadingDir(true);
    try {
      const res: DirectoryContentsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/files/dir?path=${encodeURIComponent(path)}`
      ).then(r => r.json());

      const cache: CachedDir = {
        folders: res.folders,
        files: res.files,
      };
      const nextCache = new Map(dirCache);
      nextCache.set(path, cache);
      setDirCache(nextCache);
      return cache;
    } catch (err) {
      console.error('Failed to fetch directory contents:', err);
      return { folders: [] as string[], files: [] as FileItem[] };
    } finally {
      setIsLoadingDir(false);
    }
  };

  // Use lazy-loaded directory contents when not searching
  const { folders, directFiles } = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      // Flatten view when searching - use the pre-fetched files from page.tsx
      return { folders: [], directFiles: files };
    }

    // When not searching, we rely on lazy loading from the API
    // The rendered content will be populated by useEffect below
    return { folders: [], directFiles: [] };
  }, [files, activePath, searchQuery]);

  // Load directory contents when path changes (lazy loading)
  useEffect(() => {
    if (searchQuery.trim().length > 0) return; // Skip when searching
    fetchDirContents(activePath);
  }, [activePath, searchQuery]);

  // Use cached/lazy-loaded data when not searching
  const lazyData = !searchQuery && activePath ? dirCache.get(activePath) : null;
  const displayFolders = searchQuery ? folders : (lazyData?.folders || []);
  const displayFiles = searchQuery ? directFiles : (lazyData?.files || []);

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

  // Recursive folder tree renderer for expanded folders
  const renderFolderTree = (folderName: string, path: string, depth: number) => {
    const isExpanded = expandedFolders.has(path);
    const childPath = path === '/' ? `/${folderName}` : `${path}/${folderName}`;
    const childData = dirCache.get(childPath);

    return (
      <React.Fragment key={folderName}>
        <tr
          onClick={() => navigateToFolder(folderName, path)}
          className="hover:bg-white/5 transition hover:border-l-2 hover:border-neon-blue cursor-pointer group"
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          <td className="px-4 py-3 flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-neon-blue shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-neon-blue shrink-0" />
            )}
            <Folder className="w-4 h-4 text-neon-blue shrink-0" />
            <span className="font-semibold text-gray-200">{folderName}</span>
          </td>
          <td className="px-4 py-3 text-gray-600">--</td>
          <td className="px-4 py-3 text-gray-600">--</td>
          <td className="px-4 py-3 text-gray-600">--</td>
          <td className="px-4 py-3 text-right"></td>
        </tr>
        {isExpanded && childData?.folders.map(childFolder =>
          renderFolderTree(childFolder, childPath, depth + 1)
        )}
        {isExpanded && childData?.files.map(file => (
          <FileRow
            key={file.id}
            file={file}
            depth={depth + 1}
            formatBytes={formatBytes}
            onSelectFileDetails={onSelectFileDetails}
            onAddPathToChat={onAddPathToChat}
          />
        ))}
      </React.Fragment>
    );
  };

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
                onClick={() => { setCurrentPath(crumb.path); setDirCache(new Map()); }}
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
            {/* Loading indicator */}
            {isLoadingDir && searchQuery === '' && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  Loading directory contents...
                </td>
              </tr>
            )}

            {/* SEARCH MODE: flat file list from pre-fetched data */}
            {searchQuery && displayFiles.map(file => (
              <FileRow
                key={file.id}
                file={file}
                depth={0}
                formatBytes={formatBytes}
                onSelectFileDetails={onSelectFileDetails}
                onAddPathToChat={onAddPathToChat}
              />
            ))}

            {/* ROOT LEVEL (activePath === '/'): flat folder + file list, no chevrons */}
            {!searchQuery && activePath === '/' && !isLoadingDir && (
              <>
                {displayFolders.map(folder => (
                  <tr
                    key={folder}
                    onClick={() => navigateToFolder(folder, activePath)}
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
                {displayFiles.map(file => (
                  <FileRow
                    key={file.id}
                    file={file}
                    depth={0}
                    formatBytes={formatBytes}
                    onSelectFileDetails={onSelectFileDetails}
                    onAddPathToChat={onAddPathToChat}
                  />
                ))}
              </>
            )}

            {/* NON-ROOT LEVEL: expanded tree view with chevrons for current folder's children */}
            {!searchQuery && activePath !== '/' && !isLoadingDir && (() => {
              const currentFolderKey = activePath;
              const isCurrentExpanded = expandedFolders.has(currentFolderKey);
              const currentData = dirCache.get(activePath);

              return (
                <>
                  {/* Folders at this level - always shown as flat list (clicking navigates deeper) */}
                  {displayFolders.map(folder => (
                    <tr
                      key={folder}
                      onClick={() => navigateToFolder(folder, activePath)}
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
                  {/* Files at this level */}
                  {displayFiles.map(file => (
                    <FileRow
                      key={file.id}
                      file={file}
                      depth={0}
                      formatBytes={formatBytes}
                      onSelectFileDetails={onSelectFileDetails}
                      onAddPathToChat={onAddPathToChat}
                    />
                  ))}
                </>
              );
            })()}

            {/* Empty state */}
            {!searchQuery && !isLoadingDir && displayFolders.length === 0 && displayFiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No files found in this directory.
                </td>
              </tr>
            )}
            {searchQuery && displayFiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No files match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Separate component for file rows to keep code clean
function FileRow({
  file,
  depth,
  formatBytes,
  onSelectFileDetails,
  onAddPathToChat,
}: {
  file: FileItem;
  depth: number;
  formatBytes: (bytes: number) => string;
  onSelectFileDetails?: (fileId: number) => void;
  onAddPathToChat?: (filename: string, fullPath: string) => void;
}) {
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

  return (
    <tr
      onClick={() => onSelectFileDetails?.(file.id)}
      className="hover:bg-white/5 transition hover:border-l-2 hover:border-neon-pink cursor-pointer group"
      style={{ paddingLeft: `${depth * 24 + 16}px` }}
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
          {onAddPathToChat && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddPathToChat(file.filename, file.file_path); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
              title="Add to chat"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
