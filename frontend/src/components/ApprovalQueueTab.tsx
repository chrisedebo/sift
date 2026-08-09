'use client';

import React, { useState } from 'react';
import { Trash2, Play, Check, XCircle, Info, CheckSquare, Square } from 'lucide-react';
import { ActionItem } from '../lib/api';

interface ApprovalQueueTabProps {
  queue: ActionItem[];
  onClearQueue: () => void;
  onExecuteAllApproved: () => void;
  onApproveBulk: (ids: number[]) => void;
  onRejectBulk: (ids: number[]) => void;
  onExecute: (id: number) => void;
  onSelectFileDetails?: (fileId: number) => void;
}

export default function ApprovalQueueTab({
  queue,
  onClearQueue,
  onExecuteAllApproved,
  onApproveBulk,
  onRejectBulk,
  onExecute,
  onSelectFileDetails
}: ApprovalQueueTabProps) {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const pendingItems = queue.filter(item => item.status === 'pending');
  const allPendingSelected = pendingItems.length > 0 && pendingItems.every(item => selectedItems.has(item.id));

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems.map(item => item.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const handleBulkApprove = () => {
    onApproveBulk(Array.from(selectedItems));
    setSelectedItems(new Set());
  };

  const handleBulkReject = () => {
    onRejectBulk(Array.from(selectedItems));
    setSelectedItems(new Set());
  };

  return (
    <div className="space-y-4 pb-24 relative min-h-[50vh]">
      <div className="flex items-center justify-between glass-panel border border-white/10 rounded-xl p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-200 neon-text">Execution Queue</h2>
          <p className="text-xs text-gray-400">Review and batch-approve proposed intelligence actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearQueue}
            className="futuristic-btn text-rose-300 font-medium text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear Queue
          </button>
          <button
            onClick={onExecuteAllApproved}
            className="futuristic-btn active text-white font-medium text-xs px-3.5 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Execute All Approved
          </button>
        </div>
      </div>

      <div className="glass-panel border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/40 border-b border-white/10 text-gray-400 font-medium">
            <tr>
              <th className="px-4 py-3 w-10">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white transition">
                  {allPendingSelected ? <CheckSquare className="w-4 h-4 text-neon-blue" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Action Preview</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-300">
            {queue.map((item) => (
              <tr 
                key={item.id} 
                onClick={() => onSelectFileDetails?.(item.file_id)}
                className={`hover:bg-white/5 transition cursor-pointer group ${selectedItems.has(item.id) ? 'bg-blue-500/10' : ''}`}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {item.status === 'pending' && (
                    <button onClick={() => toggleSelect(item.id)} className="text-gray-400 hover:text-white transition-transform duration-200 hover:scale-110 active:scale-95">
                      {selectedItems.has(item.id) ? <CheckSquare className="w-4 h-4 text-neon-blue" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 bg-blue-500/10 text-neon-blue neon-text border border-white/10 rounded font-medium">
                    {item.category || 'Organize'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-[10px] space-y-1">
                    <p className="text-rose-400/90 truncate">- {item.source_path}</p>
                    <p className="text-emerald-400/90 truncate">+ {item.target_path}</p>
                  </div>
                  {item.reasoning && <p className="text-[10px] text-gray-500 italic mt-1 truncate max-w-md">"{item.reasoning}"</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    item.status === 'executed' ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30' :
                    item.status === 'rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectFileDetails?.(item.file_id); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                      <Info className="w-4 h-4" /> 
                    </button>
                    {(item.status === 'approved' || item.status === 'pending') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onExecute(item.id); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition"
                      >
                        <Play className="w-4 h-4" /> 
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {queue.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-xs">
                  Queue is empty. Trigger AI file analysis to generate organizational proposals.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Action Bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass-panel backdrop-blur-md bg-slate-900/60 border border-neon-blue/40 shadow-[0_0_30px_rgba(59,130,246,0.3)] rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-5 z-40">
          <span className="text-sm font-medium text-white">{selectedItems.size} items selected</span>
          <div className="h-4 w-px bg-white/20"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApprove}
              className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5" /> Approve Selected
            </button>
            <button
              onClick={handleBulkReject}
              className="bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
