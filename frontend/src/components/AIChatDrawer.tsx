'use client';

import React, { useRef, useEffect } from 'react';
import { Bot, User, ChevronDown, Terminal, Loader2, Send, PlusCircle } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  type?: 'qa' | 'scriptlet' | 'action';
}

interface AIChatDrawerProps {
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isAnalyzing: boolean;
  progressCompleted: number;
  progressTotal: number;
  progressPercent: number;
  pendingQueueCount: number;
  onSendChatCommand: (customPrompt?: string) => void;
  onNewConversation?: () => void;
}

export default function AIChatDrawer({
  isChatOpen,
  setIsChatOpen,
  chatMessages,
  chatInput,
  setChatInput,
  isAnalyzing,
  progressCompleted,
  progressTotal,
  progressPercent,
  pendingQueueCount,
  onSendChatCommand,
  onNewConversation
}: AIChatDrawerProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAnalyzing]);

  if (!isChatOpen) {
    return (
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs px-4 py-3 rounded-full shadow-2xl border border-indigo-400/30 flex items-center gap-2.5 z-50 transition-all hover:scale-105"
      >
        <Bot className="w-5 h-5 text-indigo-200" />
        <span>Sift AI Assistant</span>
        {pendingQueueCount > 0 && (
          <span className="bg-indigo-400 text-gray-950 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
            {pendingQueueCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-[#0d1322] border border-indigo-500/30 rounded-2xl shadow-2xl flex flex-col h-[540px] overflow-hidden z-50 transition-all duration-200 animate-in slide-in-from-bottom-5">
      {/* Widget Header */}
      <div className="bg-[#131b2e] border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30 text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-gray-100">Sift AI Assistant</h3>
            <p className="text-[10px] text-indigo-400 font-medium">Media Q&A, Metadata & Scriptlets</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-800/50 text-[11px] font-medium px-2 py-1 rounded-md flex items-center gap-1 transition"
              title="Start a new conversation session and clear context"
            >
              <PlusCircle className="w-3 h-3 text-indigo-400" />
              <span>New</span>
            </button>
          )}
          <button
            onClick={() => setIsChatOpen(false)}
            className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-800 transition"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Presets Bar inside Chat */}
      <div className="bg-[#0b0f19] border-b border-gray-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px]">
        <button
          onClick={() => onSendChatCommand('What album is Fax to the brain 1 from and who composed it?')}
          className="bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 px-2 py-1 rounded-md shrink-0 transition"
        >
          🎵 What album is this track from?
        </button>
        <button
          onClick={() => onSendChatCommand('Who directed 2012.mkv and when was it released?')}
          className="bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 px-2 py-1 rounded-md shrink-0 transition"
        >
          🎬 Who directed 2012.mkv?
        </button>
        <button
          onClick={() => onSendChatCommand('```python\nimport os\nprint("Files in storage:", len(os.listdir("/mnt/big-storage")))\n```')}
          className="bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 px-2 py-1 rounded-md shrink-0 transition flex items-center gap-1"
        >
          <Terminal className="w-3 h-3 text-emerald-400" /> Run Python scriptlet
        </button>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs bg-[#0b0f19]">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`p-1.5 rounded-lg text-xs shrink-0 ${
              msg.sender === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-indigo-400 border border-indigo-500/20'
            }`}>
              {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
              msg.sender === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-none'
                : 'bg-[#131b2e] text-gray-200 border border-gray-800 rounded-tl-none space-y-1'
            }`}>
              <div className="whitespace-pre-wrap leading-relaxed font-sans">{msg.text}</div>
              <span className={`block text-[9px] ${msg.sender === 'user' ? 'text-indigo-200' : 'text-gray-500'} text-right mt-1`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isAnalyzing && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-950/50 border border-indigo-800/40 p-2.5 rounded-xl">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Consulting Sift AI Assistant & extracting disk metadata...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Chat Input Footer */}
      <div className="bg-[#131b2e] border-t border-gray-800 p-2.5 flex items-center gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSendChatCommand()}
          placeholder="Ask Sift (e.g. 'What album is this from?')..."
          className="flex-1 bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 font-mono"
        />
        <button
          onClick={() => onSendChatCommand()}
          disabled={isAnalyzing || !chatInput.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
