
import React, { useState, useEffect } from 'react';
import { PageHeader } from './ui/PageHeader.tsx';
import { DatabaseIcon } from './icons/DatabaseIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { SyncIcon } from './icons/SyncIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { getGenericDocuments, saveGenericDocument, deleteGenericDocument } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { Timestamp } from '@firebase/firestore';

interface DatabaseManagerPageProps {
    setAdminSubPage: (page: 'dashboard') => void;
}

const COLLECTIONS = [
    'users',
    'public_users',
    'userPicks',
    'app_state',
    'admin_logs',
    'invitation_codes',
    'dues_payments',
    'email_verifications',
    'rate_limits_ip'
];

const DatabaseLoader = () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] w-full bg-carbon-black/20 animate-fade-in gap-6">
        <div className="relative w-20 h-20">
            {/* Outer Ring */}
            <div className="absolute inset-0 border-2 border-t-primary-red border-r-transparent border-b-primary-red border-l-transparent rounded-full animate-spin"></div>
            {/* Inner Ring */}
            <div className="absolute inset-3 border-2 border-t-transparent border-r-highlight-silver border-b-transparent border-l-highlight-silver rounded-full animate-spin-reverse opacity-70"></div>
            {/* Core Pulse */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-primary-red rounded-full animate-ping"></div>
            </div>
        </div>
        
        <div className="text-center space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-highlight-silver">
                Establishing Secure Uplink
            </p>
            <div className="flex items-center justify-center gap-1">
                <span className="w-1 h-1 bg-primary-red rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1 h-1 bg-pure-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1 h-1 bg-primary-red rounded-full animate-bounce"></span>
            </div>
        </div>
    </div>
);

const DatabaseManagerPage: React.FC<DatabaseManagerPageProps> = ({ setAdminSubPage }) => {
    const [selectedCollection, setSelectedCollection] = useState<string>(COLLECTIONS[0]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPaging, setIsPaging] = useState(false);
    
    // Editor State
    const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
    const [jsonContent, setJsonContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    
    // Delete Confirmation State
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { showToast } = useToast();

    // Fetch Logic
    const fetchDocs = async (collectionName: string, isMore = false) => {
        if (isMore) setIsPaging(true);
        else setIsLoading(true);

        try {
            // Artificial delay for smoother transition (min 600ms)
            const [result] = await Promise.all([
                getGenericDocuments(collectionName, 20, isMore ? lastDoc : null),
                !isMore ? new Promise(resolve => setTimeout(resolve, 600)) : Promise.resolve()
            ]);
            
            const { docs, lastDoc: nextLast } = result;

            if (isMore) {
                setDocuments(prev => [...prev, ...docs]);
            } else {
                setDocuments(docs);
            }
            setLastDoc(nextLast);
        } catch (error) {
            console.error(error);
            showToast(`Failed to load collection ${collectionName}`, 'error');
        } finally {
            setIsLoading(false);
            setIsPaging(false);
        }
    };

    useEffect(() => {
        setDocuments([]);
        setLastDoc(null);
        fetchDocs(selectedCollection);
    }, [selectedCollection]);

    // Formatters
    const getPreviewField = (doc: any) => {
        if (doc.displayName) return doc.displayName;
        if (doc.email) return doc.email;
        if (doc.name) return doc.name;
        if (doc.code) return doc.code;
        if (doc.action) return doc.action; // Admin logs
        // App State specifics
        if (selectedCollection === 'app_state') {
            return 'Configuration Document';
        }
        // Fallback for public_users without display name
        if (selectedCollection === 'public_users') {
             return <span className="text-highlight-silver italic opacity-70">ID: {doc.id}</span>;
        }
        return <span className="text-highlight-silver italic">No Label</span>;
    };

    const getSecondField = (doc: any) => {
        if (doc.lastUpdated) {
             const date = doc.lastUpdated.toDate ? doc.lastUpdated.toDate() : new Date(doc.lastUpdated);
             return date.toLocaleString();
        }
        if (doc.createdAt) {
            const date = doc.createdAt.toDate ? doc.createdAt.toDate() : new Date(doc.createdAt);
            return date.toLocaleString();
        }
        if (doc.timestamp) {
             const date = doc.timestamp.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp);
             return date.toLocaleString();
        }
        if (doc.status) return doc.status.toUpperCase();
        if (doc.rank) return `Rank #${doc.rank}`;
        return null;
    };

    // Editor Handlers
    const openEditor = (doc: any) => {
        setSelectedDoc(doc);
        setConfirmDelete(false); // Reset confirmation state
        // Exclude ID from the editable JSON body to prevent confusion
        const { id, ...data } = doc;
        setJsonContent(JSON.stringify(data, null, 2));
        setJsonError(null);
    };

    const closeEditor = () => {
        setSelectedDoc(null);
        setJsonContent('');
        setJsonError(null);
        setConfirmDelete(false);
        setIsSaving(false);
    };

    const handleSave = async () => {
        if (!selectedDoc) return;
        setIsSaving(true);
        setJsonError(null);

        try {
            // Reviver function to restore Firestore Timestamps
            const parsed = JSON.parse(jsonContent, (key, value) => {
                if (value && typeof value === 'object') {
                    if ('seconds' in value && 'nanoseconds' in value) {
                        return new Timestamp(value.seconds, value.nanoseconds);
                    }
                }
                return value;
            });

            await saveGenericDocument(selectedCollection, selectedDoc.id, parsed);
            showToast("Document saved successfully.", 'success');
            
            // Refresh local list state
            setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { id: selectedDoc.id, ...parsed } : d));
            closeEditor();
        } catch (error: any) {
            console.error(error);
            setJsonError(error.message || "Invalid JSON or Schema Error");
            showToast("Failed to save document. Check console.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = () => {
        setConfirmDelete(true);
    };

    const confirmDeletion = async () => {
        if (!selectedDoc) return;
        
        setIsSaving(true);
        try {
            await deleteGenericDocument(selectedCollection, selectedDoc.id);
            setDocuments(prev => prev.filter(d => d.id !== selectedDoc.id));
            showToast("Document deleted successfully.", 'success');
            closeEditor();
        } catch (error) {
            console.error(error);
            showToast("Failed to delete document.", 'error');
            setIsSaving(false);
        }
    };

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(jsonContent);
        showToast("JSON copied to clipboard", 'info');
    };

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden text-pure-white w-full max-w-7xl mx-auto">
            <div className="flex-none">
                <PageHeader 
                    title="DATABASE MANAGER" 
                    icon={DatabaseIcon} 
                    leftAction={DashboardAction}
                />
            </div>

            <div className="flex-1 flex flex-col min-h-0 px-2 md:px-0 pb-0 md:pb-8">
                
                {/* Main: Document List */}
                <div className="flex-1 bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-xl overflow-hidden flex flex-col min-h-0">
                    {/* Unified Header with Dropdown */}
                    <div className="p-3 md:p-4 border-b border-pure-white/10 bg-carbon-black/50 flex justify-between items-center flex-none gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <h3 className="text-xs font-black text-highlight-silver uppercase tracking-widest hidden sm:block">
                                Collection:
                            </h3>
                            <div className="relative w-full sm:w-72">
                                <select
                                    value={selectedCollection}
                                    onChange={(e) => setSelectedCollection(e.target.value)}
                                    className="w-full appearance-none bg-carbon-black border border-pure-white/20 rounded-lg py-2 pl-3 pr-10 text-pure-white font-bold uppercase tracking-wider focus:outline-none focus:border-primary-red focus:ring-1 focus:ring-primary-red shadow-lg transition-colors text-xs md:text-sm"
                                >
                                    {COLLECTIONS.map(col => (
                                        <option key={col} value={col} className="bg-carbon-black text-ghost-white">{col}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-highlight-silver">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="hidden md:block text-[10px] font-mono text-highlight-silver opacity-50 mr-2">
                                {documents.length} items visible
                            </span>
                            <button 
                                onClick={() => fetchDocs(selectedCollection)} 
                                className="p-2 hover:bg-pure-white/10 rounded-full transition-colors text-highlight-silver hover:text-pure-white border border-transparent hover:border-pure-white/10"
                                title="Refresh"
                            >
                                <SyncIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-carbon-black/20 pb-24 md:pb-0 relative">
                        {isLoading ? (
                            <DatabaseLoader />
                        ) : documents.length === 0 ? (
                            <div className="p-12 text-center text-highlight-silver italic opacity-50 flex flex-col items-center justify-center h-full">
                                <DatabaseIcon className="w-16 h-16 mb-4 opacity-20" />
                                <span>No documents found in {selectedCollection}.</span>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                {/* Desktop Table Header */}
                                <div className="hidden md:grid grid-cols-12 gap-4 bg-carbon-black/30 sticky top-0 z-10 p-3 border-b border-pure-white/10 text-[10px] font-black uppercase text-highlight-silver tracking-widest backdrop-blur-sm">
                                    <div className="col-span-3">ID</div>
                                    <div className="col-span-6">Preview</div>
                                    <div className="col-span-3 text-right">Meta</div>
                                </div>

                                {/* List Items (Responsive: Cards on Mobile, Grid Rows on Desktop) */}
                                <div className="p-2 md:p-0 space-y-2 md:space-y-0">
                                    {documents.map(doc => (
                                        <div 
                                            key={doc.id}
                                            onClick={() => openEditor(doc)}
                                            className="group relative flex flex-col md:grid md:grid-cols-12 md:gap-4 p-4 md:p-3 rounded-lg md:rounded-none md:border-b border-pure-white/10 bg-carbon-fiber md:bg-transparent hover:bg-pure-white/5 transition-all cursor-pointer border border-pure-white/5 md:border-x-0 md:border-t-0 shadow-md md:shadow-none animate-fade-in"
                                        >
                                            {/* ID Column */}
                                            <div className="md:col-span-3 flex items-center justify-between md:block mb-2 md:mb-0">
                                                <span className="font-mono text-xs text-highlight-silver group-hover:text-primary-red transition-colors truncate block max-w-[200px] md:max-w-full" title={doc.id}>
                                                    <span className="md:hidden text-[9px] uppercase tracking-widest opacity-50 mr-2 font-sans font-bold">ID:</span>
                                                    {doc.id}
                                                </span>
                                                {/* Mobile Meta (Top Right) */}
                                                <span className="md:hidden text-[9px] text-highlight-silver font-mono bg-pure-white/5 px-2 py-0.5 rounded border border-pure-white/5">
                                                    {getSecondField(doc)}
                                                </span>
                                            </div>

                                            {/* Preview Column */}
                                            <div className="md:col-span-6 text-sm font-bold text-pure-white truncate w-full mb-1 md:mb-0">
                                                {getPreviewField(doc)}
                                            </div>

                                            {/* Desktop Meta Column */}
                                            <div className="hidden md:block col-span-3 text-xs text-highlight-silver text-right font-mono truncate">
                                                {getSecondField(doc)}
                                            </div>
                                            
                                            {/* Mobile tap indicator */}
                                            <div className="md:hidden absolute right-3 bottom-3 opacity-20">
                                                <svg className="w-4 h-4 text-highlight-silver" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {lastDoc && !isLoading && (
                            <div className="p-4 text-center">
                                <button
                                    onClick={() => fetchDocs(selectedCollection, true)}
                                    disabled={isPaging}
                                    className="px-6 py-2 bg-carbon-black border border-pure-white/10 rounded-lg text-xs font-bold text-highlight-silver hover:text-pure-white hover:border-pure-white/30 transition-all disabled:opacity-50 w-full md:w-auto"
                                >
                                    {isPaging ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* JSON Editor Modal (Full Screen on Mobile) */}
            {selectedDoc && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-carbon-black/95 backdrop-blur-md p-0 md:p-4 animate-fade-in" onClick={closeEditor}>
                    <div className="bg-carbon-fiber md:border border-pure-white/10 rounded-none md:rounded-xl w-full md:w-[95vw] md:max-w-[1600px] h-full md:h-[90vh] flex flex-col shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        
                        {/* Header */}
                        <div className="p-4 border-b border-pure-white/10 bg-carbon-black/80 flex flex-row justify-between items-center gap-3 shrink-0 pb-safe-top">
                            <div className="min-w-0">
                                <h3 className="text-lg md:text-xl font-bold text-pure-white">Edit Document</h3>
                                <p className="text-[10px] md:text-xs text-highlight-silver font-mono truncate max-w-[200px] md:max-w-none opacity-70">
                                    {selectedCollection} / {selectedDoc.id}
                                </p>
                            </div>
                            <button 
                                onClick={closeEditor} 
                                className="bg-pure-white/10 hover:bg-pure-white/20 text-pure-white rounded-full p-2 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 bg-[#1e1e1e] p-0 relative overflow-hidden flex flex-col">
                            <div className="absolute top-2 right-2 z-10">
                                <button onClick={handleCopyToClipboard} className="p-2 bg-carbon-black/80 rounded hover:bg-pure-white/10 text-highlight-silver transition-colors border border-pure-white/5" title="Copy JSON">
                                    <CopyIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <textarea
                                value={jsonContent}
                                onChange={(e) => {
                                    setJsonContent(e.target.value);
                                    setJsonError(null);
                                }}
                                className="w-full h-full bg-transparent text-green-400 font-mono text-xs md:text-base leading-relaxed p-4 md:p-6 outline-none resize-none"
                                spellCheck={false}
                                autoCapitalize="off"
                                autoComplete="off"
                                autoCorrect="off"
                            />
                        </div>

                        {/* Footer / Error Bar */}
                        <div className="p-4 border-t border-pure-white/10 bg-carbon-black/80 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 pb-safe-bottom">
                            
                            {confirmDelete ? (
                                <div className="w-full flex flex-col md:flex-row gap-4 items-center animate-fade-in">
                                    <div className="flex-1 text-red-500 font-bold text-sm text-center md:text-left">
                                        ⚠️ Delete this document permanently?
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto justify-center">
                                        <button
                                            onClick={() => setConfirmDelete(false)}
                                            disabled={isSaving}
                                            type="button"
                                            className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-transparent border border-highlight-silver text-highlight-silver font-bold rounded-lg text-xs uppercase hover:text-pure-white hover:border-pure-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmDeletion}
                                            disabled={isSaving}
                                            type="button"
                                            className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-red-600 hover:bg-red-500 text-pure-white font-bold rounded-lg shadow-lg text-xs uppercase flex items-center justify-center gap-2 transition-all"
                                        >
                                            {isSaving ? <SyncIcon className="animate-spin w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
                                            Yes, Delete
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col md:flex-row gap-4">
                                    <div className="flex-1 w-full md:w-auto order-2 md:order-1">
                                        {jsonError ? (
                                            <p className="text-xs font-bold text-red-500 bg-red-900/20 px-3 py-2 rounded border border-red-500/30 text-center md:text-left">
                                                Syntax Error: {jsonError}
                                            </p>
                                        ) : (
                                            <p className="text-[10px] md:text-xs text-highlight-silver opacity-60 text-center md:text-left hidden md:block">
                                                Standard JSON format required. Keys must be quoted.
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto justify-end order-1 md:order-2">
                                        <button
                                            onClick={handleDeleteClick}
                                            disabled={isSaving}
                                            type="button"
                                            className="px-4 py-3 md:py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold rounded-lg border border-red-500/30 text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 flex-1 md:flex-none"
                                        >
                                            <TrashIcon className="w-4 h-4" /> <span className="md:hidden">Delete</span>
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || !!jsonError}
                                            type="button"
                                            className="px-6 py-3 md:py-2 bg-primary-red hover:bg-red-600 text-pure-white font-bold rounded-lg shadow-lg text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 flex-[2] md:flex-none"
                                        >
                                            {isSaving ? <SyncIcon className="animate-spin w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatabaseManagerPage;