'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, XCircle, Play, FileText, Music, Image as ImageIcon, Film, HardDrive, Info, MessageSquare, Sparkles } from 'lucide-react';
import { FileItem, ActionItem, fetchFileDetails } from '../lib/api';

interface FileDetailsModalProps {
  fileId: number | null;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onExecute: (id: number) => void;
  onAddPathToChat: (filename: string, fullPath: string) => void;
}

export default function FileDetailsModal({
  fileId,
  onClose,
  onApprove,
  onReject,
  onExecute,
  onAddPathToChat
}: FileDetailsModalProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    fetchFileDetails(fileId)
      .then(res => {
        setDetails(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [fileId]);

  if (!fileId) return null;

  const file: FileItem = details?.file;
  const diskMeta = details?.disk_metadata || {};
  const actionItem: ActionItem | null = details?.action_item;
  const isImage = file?.extension && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(file.extension.toLowerCase());
  const isAudio = file?.extension && ['.mp3', '.flac', '.wav', '.m4a', '.ogg'].includes(file.extension.toLowerCase());

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const previewUrl = `${API_BASE}/api/files/${fileId}/preview`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0d1322] border border-gray-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#131b2e] border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              {isImage ? <ImageIcon className="w-5 h-5" /> : isAudio ? <Music className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-100">{file?.filename || 'Loading File Details...'}</h2>
              <p className="text-xs text-gray-400 font-mono">{file?.file_path}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading && (
            <div className="py-12 text-center text-indigo-400 animate-pulse">
              Extracting disk metadata and ActionItem status...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
              Failed to load details: {error}
            </div>
          )}

          {details && (
            <>
              {/* Media Preview & Badges Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Visual Preview */}
                <div className="bg-[#0b0f19] border border-gray-800/80 rounded-xl p-4 flex flex-col items-center justify-center min-h-[180px]">
                  {isImage ? (
                    <img
                      src={previewUrl}
                      alt={file.filename}
                      className="max-h-56 w-auto rounded-lg object-contain border border-gray-800 shadow-lg"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : isAudio ? (
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                        <Music className="w-8 h-8" />
                      </div>
                      <p className="text-gray-300 font-semibold">{diskMeta?.embedded_tags?.title || file.filename}</p>
                      {diskMeta?.embedded_tags?.artist && (
                        <p className="text-indigo-400">{diskMeta.embedded_tags.artist}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center space-y-2 text-gray-400">
                      <FileText className="w-12 h-12 mx-auto text-gray-600" />
                      <p>{file.mime_type}</p>
                    </div>
                  )}
                </div>

                {/* File Properties & Summary */}
                <div className="space-y-4">
                  <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Category:</span>
                      <span className="font-semibold text-indigo-300">{file.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">File Size:</span>
                      <span className="font-mono text-gray-200">{(file.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Extension:</span>
                      <span className="font-mono text-gray-200">{file.extension}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300">
                        {file.status}
                      </span>
                    </div>
                  </div>

                  {file.summary && (
                    <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-4 space-y-1">
                      <h4 className="font-semibold text-gray-300 text-xs">AI Description Summary:</h4>
                      <p className="text-gray-400 leading-relaxed">{file.summary}</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      onAddPathToChat(file.filename, file.file_path);
                      onClose();
                    }}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition"
                  >
                    <MessageSquare className="w-4 h-4 text-indigo-400" /> Ask AI Questions in Chat
                  </button>
                </div>
              </div>

              {/* Deep Metadata Grid */}
              <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2 text-xs">
                  <Info className="w-4 h-4 text-indigo-400" /> Embedded Disk Metadata (ID3 / EXIF)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px]">
                  {/* ID3 Tags */}
                  {diskMeta?.embedded_tags && Object.keys(diskMeta.embedded_tags).length > 0 && (
                    <div className="bg-[#0b0f19] border border-gray-800/80 rounded-lg p-3 space-y-1.5">
                      <p className="text-indigo-400 font-sans font-semibold mb-2">🎵 Media ID3 Tags</p>
                      {Object.entries(diskMeta.embedded_tags).map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-gray-800/40 py-0.5">
                          <span className="text-gray-400 capitalize">{k}:</span>
                          <span className="text-gray-200 font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* EXIF Data */}
                  {diskMeta?.exif_data && Object.keys(diskMeta.exif_data).length > 0 && (
                    <div className="bg-[#0b0f19] border border-gray-800/80 rounded-lg p-3 space-y-1.5">
                      <p className="text-indigo-400 font-sans font-semibold mb-2">📷 Camera EXIF Metadata</p>
                      {Object.entries(diskMeta.exif_data).map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-gray-800/40 py-0.5">
                          <span className="text-gray-400 capitalize">{k}:</span>
                          <span className="text-gray-200 font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Image Info */}
                  {diskMeta?.image_info && Object.keys(diskMeta.image_info).length > 0 && (
                    <div className="bg-[#0b0f19] border border-gray-800/80 rounded-lg p-3 space-y-1.5">
                      <p className="text-indigo-400 font-sans font-semibold mb-2">🖼️ Image Resolution & Format</p>
                      {Object.entries(diskMeta.image_info).map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-gray-800/40 py-0.5">
                          <span className="text-gray-400 capitalize">{k}:</span>
                          <span className="text-gray-200 font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ActionItem Proposal Section */}
              {actionItem && (
                <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-indigo-300 text-xs flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" /> Pending ActionItem Proposal
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {actionItem.status}
                    </span>
                  </div>

                  <div className="bg-[#0b0f19] border border-gray-800/80 rounded-lg p-3 font-mono text-xs space-y-1">
                    <p className="text-rose-400/90 truncate">- FROM: {actionItem.source_path}</p>
                    <p className="text-emerald-400/90 truncate">+ TO:   {actionItem.target_path}</p>
                  </div>

                  {actionItem.reasoning && (
                    <p className="text-xs text-gray-400 italic">"{actionItem.reasoning}"</p>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2">
                    {actionItem.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            onApprove(actionItem.id);
                            onClose();
                          }}
                          className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            onReject(actionItem.id);
                            onClose();
                          }}
                          className="bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        onExecute(actionItem.id);
                        onClose();
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Execute Now
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
