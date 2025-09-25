import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Language } from "@shared/schema";

// Comprehensive translation dictionaries
const translations = {
  en: {
    // Navigation
    dashboard: "Dashboard",
    opcuaServers: "OPC UA Servers",
    addNew: "Add New",
    
    // Dashboard
    dashboardTitle: "OPC UA Dashboard",
    realTimeData: "Real-time Data",
    lastUpdated: "Last updated",
    connectionStatus: "Connection Status",
    
    // Server management
    serverUrl: "Server URL",
    status: "Status",
    plcCount: "PLC Count",
    lastUpdate: "Last Update",
    connected: "Connected",
    disconnected: "Disconnected",
    maintenance: "Maintenance",
    error: "Error",
    active: "Active",
    inactive: "Inactive",
    
    // PLC details
    plcName: "PLC Name",
    plcIp: "PLC IP",
    opcuaUrl: "OPC UA URL",
    registerCount: "Register Count",
    boolCount: "Bool Variables",
    channelCount: "Channel Variables",
    
    // Variables table
    name: "Name",
    description: "Description",
    value: "Value",
    type: "Type",
    address: "Address",
    nodeId: "Node ID",
    dataType: "Data Type",
    channel: "Channel",
    bool: "Bool",
    
    // File upload
    uploadJsonConfig: "Upload JSON Configuration",
    dragDropFile: "Drop your JSON file here",
    browseFiles: "Browse Files",
    processingFile: "Processing file...",
    addToDatabase: "Add to Database",
    uploadAnother: "Upload Another",
    
    // Actions
    expand: "Expand",
    collapse: "Collapse",
    select: "Select",
    deselect: "Deselect",
    filter: "Filter",
    search: "Search",
    refresh: "Refresh",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    
    // Status messages
    success: "Success",
    warning: "Warning",
    loading: "Loading",
    noData: "No data available",
    serverConnected: "Server connected successfully",
    serverDisconnected: "Server disconnected",
    configUploaded: "Configuration uploaded successfully",
    plcAdded: "PLC Added",
    plcAddedSuccess: "Successfully added new PLC configuration",
    plcAddFailed: "Failed to Add PLC",
    plcDeleted: "PLC Deleted",
    plcDeletedSuccess: "Successfully deleted PLC configuration",
    plcDeleteFailed: "Failed to Delete PLC",
    dataRefreshed: "Data has been refreshed",
    
    // Language selector
    language: "Language",
    english: "English",
    japanese: "Japanese",
    
    // Time formats
    timeAgo: "ago",
    justNow: "just now",
    minute: "minute",
    minutes: "minutes",
    hour: "hour", 
    hours: "hours",
    day: "day",
    days: "days",
    
    // Errors
    errorOccurred: "An error occurred",
    connectionFailed: "Connection failed",
    invalidFile: "Invalid file format",
    uploadFailed: "Upload failed",
    
    // Variables table
    variables: "Variables",
    variablesTable: "Variables Table",
    totalVariables: "Total Variables",
    nodeName: "Node Name",
    timestamp: "Timestamp",
    userDescription: "User Description",
    selected: "Selected",
    showAll: "Show All",
    showSelected: "Show Selected",
    noMatchingVariables: "No matching variables found",
    refreshing: "Refreshing",
    refreshAll: "Refresh All",
  },
  jp: {
    // Navigation
    dashboard: "ダッシュボード",
    opcuaServers: "OPC UAサーバー",
    addNew: "新規追加",
    
    // Dashboard
    dashboardTitle: "OPC UAダッシュボード",
    realTimeData: "リアルタイムデータ",
    lastUpdated: "最終更新",
    connectionStatus: "接続状態",
    
    // Server management
    serverUrl: "サーバーURL",
    status: "状態",
    plcCount: "PLC数",
    lastUpdate: "最終更新",
    connected: "接続中",
    disconnected: "切断中",
    maintenance: "メンテナンス",
    error: "エラー",
    active: "稼働中",
    inactive: "停止中",
    
    // PLC details
    plcName: "PLC名",
    plcIp: "PLC IP",
    opcuaUrl: "OPC UA URL",
    registerCount: "レジスタ数",
    boolCount: "ブール変数",
    channelCount: "チャネル変数",
    
    // Variables table
    name: "名前",
    description: "説明",
    value: "値",
    type: "種類",
    address: "アドレス",
    nodeId: "ノードID",
    dataType: "データ型",
    channel: "チャネル",
    bool: "ブール",
    
    // File upload
    uploadJsonConfig: "JSON設定ファイルアップロード",
    dragDropFile: "JSONファイルをここにドロップ",
    browseFiles: "ファイル参照",
    processingFile: "ファイル処理中...",
    addToDatabase: "データベースに追加",
    uploadAnother: "他のファイルをアップロード",
    
    // Actions
    expand: "展開",
    collapse: "折りたたみ",
    select: "選択",
    deselect: "選択解除",
    filter: "フィルター",
    search: "検索",
    refresh: "更新",
    save: "保存",
    cancel: "キャンセル",
    confirm: "確認",
    
    // Status messages
    success: "成功",
    warning: "警告",
    loading: "読み込み中",
    noData: "データがありません",
    serverConnected: "サーバー接続成功",
    serverDisconnected: "サーバー切断",
    configUploaded: "設定アップロード成功",
    plcAdded: "PLC追加",
    plcAddedSuccess: "新しいPLC設定を正常に追加しました",
    plcAddFailed: "PLC追加に失敗しました",
    plcDeleted: "PLC削除",
    plcDeletedSuccess: "PLC設定を正常に削除しました",
    plcDeleteFailed: "PLC削除に失敗しました",
    dataRefreshed: "データが更新されました",
    
    // Language selector
    language: "言語",
    english: "英語",
    japanese: "日本語",
    
    // Time formats
    timeAgo: "前",
    justNow: "たった今",
    minute: "分",
    minutes: "分",
    hour: "時間",
    hours: "時間",
    day: "日",
    days: "日",
    
    // Errors
    errorOccurred: "エラーが発生しました",
    connectionFailed: "接続に失敗しました",
    invalidFile: "無効なファイル形式",
    uploadFailed: "アップロードに失敗しました",
    
    // Variables table
    variables: "変数",
    variablesTable: "変数テーブル",
    totalVariables: "総変数",
    nodeName: "ノード名",
    timestamp: "タイムスタンプ",
    userDescription: "ユーザ説明",
    selected: "選択済み",
    showAll: "すべて表示",
    showSelected: "選択済みを表示",
    noMatchingVariables: "一致する変数が見つかりません",
    refreshing: "更新中",
    refreshAll: "すべて更新",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
  translations: typeof translations[Language];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get language from localStorage, fallback to English
    try {
      const saved = localStorage.getItem("opcua-dashboard-language");
      return (saved === "en" || saved === "jp") ? saved : "en";
    } catch {
      return "en";
    }
  });

  // Persist language changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("opcua-dashboard-language", language);
    } catch {
      // localStorage may not be available
    }
  }, [language]);

  // Translation function
  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    translations: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

// Export translations for components that need direct access
export { translations };