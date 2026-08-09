'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, X, Loader2, Send, PlusCircle, Maximize2, Minimize2, Image as ImageIcon, Music, FileText, Search } from 'lucide-react';
import { fetchFileDetails, FileItem, ActionItem } from '../lib/api';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  type?: 'qa' | 'scriptlet' | 'action';
}

interface IntelligencePanelProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isAnalyzing: boolean;
  onSendChatCommand: (customPrompt?: string) => void;
  onNewConversation?: () => void;
  selectedFileId: number | null;
}

export default function IntelligencePanel({
  isOpen,
  setIsOpen,
  chatMessages,
  chatInput,
  setChatInput,
  isAnalyzing,
  onSendChatCommand,
  onNewConversation,
  selectedFileId
}: IntelligencePanelProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [fileDetails, setFileDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAnalyzing]);

  useEffect(() => {
    if (!selectedFileId) {
      setFileDetails(null);
      return;
    }
    setLoadingDetails(true);
    fetchFileDetails(selectedFileId)
      .then(res => setFileDetails(res))
      .catch(console.error)
      .finally(() => setLoadingDetails(false));
  }, [selectedFileId]);

  if (!isOpen) return null;

  const file: FileItem | undefined = fileDetails?.file;
  const isImage = file?.extension && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(file.extension.toLowerCase());
  const isAudio = file?.extension && ['.mp3', '.flac', '.wav', '.m4a', '.ogg'].includes(file.extension.toLowerCase());
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const previewUrl = selectedFileId ? `${API_BASE}/api/files/${selectedFileId}/preview` : '';

  return (
    <div className={`fixed top-0 right-0 h-screen glass-panel border-l border-white/10 shadow-2xl flex flex-col z-50 transition-all duration-300 ease-in-out ${isExpanded ? 'w-[800px]' : 'w-96'}`}>
      {/* Panel Header */}
      <div className="glass-panel border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg futuristic-btn active">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white neon-text">Cybernetic Intelligence</h3>
            <p className="text-[10px] text-neon-blue font-medium">Sift AI Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onNewConversation && (
            <button onClick={onNewConversation} className="text-indigo-300 hover:text-white bg-black/30 border border-white/10 text-[11px] font-medium px-2 py-1 rounded-md flex items-center gap-1 transition">
              <PlusCircle className="w-3 h-3 text-neon-blue" /> New
            </button>
          )}
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sticky File Context Header */}
      {selectedFileId && (
        <div className="bg-black/40 border-b border-white/10 p-3 shrink-0 flex gap-3 animate-in fade-in slide-in-from-top-2">
          {loadingDetails ? (
            <div className="flex items-center justify-center w-full py-4">
              <Loader2 className="w-5 h-5 text-neon-blue animate-spin" />
            </div>
          ) : file ? (
            <>
              <div className="w-16 h-16 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {isImage ? (
                  <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
                    <img src={previewUrl} alt={file.filename} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Search className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ) : isAudio ? (
                  <Music className="w-6 h-6 text-neon-blue" />
                ) : (
                  <FileText className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex flex-col justify-center overflow-hidden">
                <h4 className="text-xs font-semibold text-white truncate">{file.filename}</h4>
                <p className="text-[10px] text-gray-400 font-mono truncate">{file.file_path}</p>
                <div className="mt-1 flex gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-neon-blue border border-blue-500/30">{file.category}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">{(file.file_size / (1024*1024)).toFixed(1)} MB</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-black/20">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="p-4 rounded-2xl glass-panel shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <Bot className="w-10 h-10 text-neon-blue" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white neon-text">System Ready</h3>
              <p className="text-xs text-gray-400 max-w-[250px]">I can analyze metadata, organize your media, and execute precise organizational workflows.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm mt-4">
              <button onClick={() => onSendChatCommand('Analyze metadata and categorize this file.')} className="glass-panel p-3 rounded-xl hover:bg-white/5 transition text-left space-y-1 group">
                <p className="text-xs font-medium text-neon-blue group-hover:text-neon-pink transition">Analyze File</p>
                <p className="text-[10px] text-gray-400">Extract deep metadata</p>
              </button>
              <button onClick={() => onSendChatCommand('Propose an organizational structure for this folder.')} className="glass-panel p-3 rounded-xl hover:bg-white/5 transition text-left space-y-1 group">
                <p className="text-xs font-medium text-neon-purple group-hover:text-neon-pink transition">Organize</p>
                <p className="text-[10px] text-gray-400">Suggest new layout</p>
              </button>
            </div>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`p-1.5 rounded-lg text-xs shrink-0 ${msg.sender === 'user' ? 'futuristic-btn active' : 'glass-panel text-neon-blue'}`}>
                {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${msg.sender === 'user' ? 'futuristic-btn active rounded-tr-none' : 'glass-panel rounded-tl-none space-y-2 shadow-lg shadow-black/50'}`}>
                {msg.type === 'action' ? (
                  <div className="bg-black/40 border border-neon-blue/30 rounded-lg p-3 space-y-2">
                    <p className="font-semibold text-neon-blue flex items-center gap-2"><Bot className="w-3 h-3"/> Action Proposed</p>
                    <div className="font-mono text-[10px] space-y-1">
                      <p className="text-rose-400/90 truncate">- FROM: {msg.text.split('to')[0]}</p>
                      <p className="text-emerald-400/90 truncate">+ TO: {msg.text.split('to')[1]}</p>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed font-sans font-light tracking-wide text-slate-300">{msg.text}</div>
                )}
                <span className={`block text-[9px] ${msg.sender === 'user' ? 'text-indigo-200' : 'text-gray-500'} text-right mt-1`}>{msg.timestamp}</span>
              </div>
            </div>
          ))
        )}

        {isAnalyzing && (
          <div className="flex items-center gap-2 text-xs text-neon-blue bg-black/30 border border-white/10 p-2.5 rounded-xl w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Processing intelligence request...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Chat Input Footer */}
      <div className="glass-panel border-t border-white/10 p-3 shrink-0 flex items-center gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSendChatCommand()}
          placeholder="Command the engine..."
          className="flex-1 bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-neon-blue font-mono transition shadow-inner"
        />
        <button
          onClick={() => onSendChatCommand()}
          disabled={isAnalyzing || !chatInput.trim()}
          className="futuristic-btn active p-2 rounded-xl transition disabled:opacity-50 text-white"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Lightbox Overlay */}
      {isLightboxOpen && previewUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white bg-black/50 p-2 rounded-full transition"
            onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={previewUrl} 
            alt="Enlarged Preview" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
