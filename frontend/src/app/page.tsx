'use client';

import React, { useState, useEffect } from 'react';

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DashboardTab from '../components/DashboardTab';
import FilesExplorerTab from '../components/FilesExplorerTab';
import ApprovalQueueTab from '../components/ApprovalQueueTab';
import SettingsTab from '../components/SettingsTab';
import AIChatDrawer, { ChatMessage } from '../components/AIChatDrawer';
import FileDetailsModal from '../components/FileDetailsModal';

import { 
  fetchFiles, 
  fetchStats, 
  triggerScan, 
  fetchQueue, 
  approveAction, 
  rejectAction, 
  executeAction, 
  executeAllApproved,
  clearQueue,
  fetchHealth,
  sendAssistantChat,
  FileItem,
  ActionItem,
  StatsResponse,
  HealthResponse
} from '../lib/api';

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer' | 'queue' | 'settings'>('dashboard');
  
  // Data states
  const [files, setFiles] = useState<FileItem[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [queue, setQueue] = useState<ActionItem[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  // Modal State
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scanPath, setScanPath] = useState('/mnt/big-storage');
  const [batchChunkSize, setBatchChunkSize] = useState(10);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Per-item custom prompts
  const [itemPrompts, setItemPrompts] = useState<Record<number, string>>({});

  // Floating Conversational AI Chat Assistant Widget
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hello! I am Sift, your AI file & metadata assistant. Ask me questions like "What album is this track from?", "Who directed this film?", "What metadata is in this image?", or ask me to organize files/run scriptlets!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [filesRes, statsRes, queueRes, healthRes] = await Promise.all([
        fetchFiles(selectedCategory, undefined, searchQuery, 200),
        fetchStats(),
        fetchQueue(),
        fetchHealth().catch(() => null)
      ]);
      setFiles(filesRes.items);
      setTotalFiles(filesRes.total);
      setStats(statsRes);
      setQueue(queueRes.items);
      setQueueTotal(queueRes.total);
      if (healthRes) setHealth(healthRes);
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, searchQuery]);

  const addChatMessage = (sender: 'user' | 'ai', text: string, type?: 'qa' | 'scriptlet' | 'action') => {
    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender,
        text,
        type,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleNewConversation = () => {
    setChatMessages([
      {
        id: Date.now().toString(),
        sender: 'ai',
        text: 'Started a new conversation session! What questions or file actions would you like to perform?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setStatusMessage('Started a new AI Assistant conversation session.');
  };

  const handleAddPathToChat = (filename: string, fullPath: string) => {
    setIsChatOpen(true);
    setChatInput(prev => {
      const textToAppend = `What album or metadata is available for ${filename}?`;
      return prev ? `${prev} ${textToAppend}` : textToAppend;
    });
    setStatusMessage(`Added '${filename}' to AI Assistant Chat.`);
  };

  const handleScan = async () => {
    setIsScanning(true);
    setStatusMessage('Scanning NAS directory & refreshing ID3/EXIF metadata...');
    try {
      const res = await triggerScan(scanPath, true);
      const msg = `Scan complete: ${res.data.new_indexed} new files indexed, ${res.data.updated_indexed} existing files refreshed with deep metadata!`;
      setStatusMessage(msg);
      addChatMessage('ai', `Scanned folder '${scanPath}' — ${res.data.new_indexed} new files indexed, ${res.data.updated_indexed} files refreshed with deep ID3/EXIF metadata.`);
      await loadData();
    } catch (err: any) {
      setStatusMessage(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearQueueAction = async () => {
    try {
      const res = await clearQueue();
      setStatusMessage(`Cleared ${res.deleted_count} pending proposals from the approval queue.`);
      addChatMessage('ai', `Cleared ${res.deleted_count} pending proposals from the approval queue.`);
      await loadData();
    } catch (err: any) {
      setStatusMessage(`Error clearing queue: ${err.message}`);
    }
  };

  const handleSendChatCommand = async (customPromptOverride?: string) => {
    const promptToSend = customPromptOverride || chatInput.trim();
    if (!promptToSend) return;

    addChatMessage('user', promptToSend);
    if (!customPromptOverride) setChatInput('');

    setIsAnalyzing(true);

    try {
      // Check if query is targeting specific files
      const promptLower = promptToSend.toLowerCase();
      const matchedFiles = files.filter(f => {
        const fn = f.filename.toLowerCase();
        const fp = f.file_path.toLowerCase();
        return (fn.length > 3 && promptLower.includes(fn)) || (fp.length > 5 && promptLower.includes(fp));
      });

      const fileIds = matchedFiles.length > 0 ? matchedFiles.map(f => f.id) : undefined;

      // Extract conversation history turns to maintain full multi-turn context
      const historyPayload = chatMessages
        .filter(m => m.sender === 'user' || m.sender === 'ai')
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const res = await sendAssistantChat(promptToSend, fileIds, historyPayload);

      addChatMessage('ai', res.reply, res.type);

      if (res.type === 'action') {
        await loadData();
        setActiveTab('queue');
      }
    } catch (err: any) {
      addChatMessage('ai', `Error answering query: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = async (actionId: number) => {
    try {
      await approveAction(actionId);
      await loadData();
    } catch (err: any) {
      setStatusMessage(`Error approving action: ${err.message}`);
    }
  };

  const handleReject = async (actionId: number) => {
    try {
      await rejectAction(actionId);
      await loadData();
    } catch (err: any) {
      setStatusMessage(`Error rejecting action: ${err.message}`);
    }
  };

  const handleExecute = async (actionId: number) => {
    try {
      await executeAction(actionId);
      setStatusMessage(`Executed action ID ${actionId} safely on disk.`);
      await loadData();
    } catch (err: any) {
      setStatusMessage(`Error executing action: ${err.message}`);
    }
  };

  const handleExecuteAllApproved = async () => {
    try {
      const res = await executeAllApproved();
      setStatusMessage(`Executed ${res.executed_count} approved file actions.`);
      addChatMessage('ai', `Executed ${res.executed_count} approved file actions safely on disk.`);
      await loadData();
    } catch (err: any) {
      setStatusMessage(`Execution error: ${err.message}`);
    }
  };

  const pendingQueueCount = queue.filter(q => q.status === 'pending' || q.status === 'approved').length;

  return (
    <div className="flex h-screen bg-[#0b0f19] text-gray-100 overflow-hidden font-sans relative">
      {/* Sidebar Component */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalFiles={stats?.total_files || 0}
        pendingQueueCount={pendingQueueCount}
        health={health}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0b0f19]">
        {/* Header Component */}
        <Header
          activeTab={activeTab}
          scanPath={scanPath}
          setScanPath={setScanPath}
          isScanning={isScanning}
          onScan={handleScan}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
        />

        {/* Live Status Notification Banner */}
        {statusMessage && !isAnalyzing && (
          <div className="bg-indigo-950/60 border-b border-indigo-800/40 px-6 py-2 text-xs text-indigo-300 flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="hover:text-white">✕</button>
          </div>
        )}

        {/* Dynamic Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardTab
              stats={stats}
              files={files}
              pendingQueueCount={pendingQueueCount}
              formatBytes={formatBytes}
              onNavigateExplorer={() => setActiveTab('explorer')}
              onAddPathToChat={handleAddPathToChat}
            />
          )}

          {activeTab === 'explorer' && (
            <FilesExplorerTab
              files={files}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              formatBytes={formatBytes}
              onAddPathToChat={handleAddPathToChat}
              onSendChatCommand={handleSendChatCommand}
              onSelectFileDetails={(id) => setSelectedFileId(id)}
            />
          )}

          {activeTab === 'queue' && (
            <ApprovalQueueTab
              queue={queue}
              itemPrompts={itemPrompts}
              setItemPrompts={setItemPrompts}
              onClearQueue={handleClearQueueAction}
              onExecuteAllApproved={handleExecuteAllApproved}
              onApprove={handleApprove}
              onReject={handleReject}
              onExecute={handleExecute}
              onAddPathToChat={handleAddPathToChat}
              onSendChatCommand={handleSendChatCommand}
              onSelectFileDetails={(id) => setSelectedFileId(id)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              batchChunkSize={batchChunkSize}
              setBatchChunkSize={setBatchChunkSize}
              health={health}
              onTestConnections={() => fetchHealth().then(setHealth)}
            />
          )}
        </div>
      </main>

      {/* File Details & Metadata Preview Modal */}
      <FileDetailsModal
        fileId={selectedFileId}
        onClose={() => setSelectedFileId(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onExecute={handleExecute}
        onAddPathToChat={handleAddPathToChat}
      />

      {/* Floating AI Chat Assistant Drawer Component */}
      <AIChatDrawer
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        isAnalyzing={isAnalyzing}
        progressCompleted={0}
        progressTotal={0}
        progressPercent={0}
        pendingQueueCount={pendingQueueCount}
        onSendChatCommand={handleSendChatCommand}
        onNewConversation={handleNewConversation}
      />
    </div>
  );
}
