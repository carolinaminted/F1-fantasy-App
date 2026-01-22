
import React, { useState, useEffect } from 'react';
import { PageHeader } from './ui/PageHeader.tsx';
import { DatabaseIcon } from './icons/DatabaseIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { SyncIcon } from './icons/SyncIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { getGenericDocuments, saveGenericDocument, deleteGenericDocument } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { ListSkeleton } from './LoadingSkeleton.tsx';

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

    const { showToast } = useToast();

    // Fetch Logic
    const fetchDocs = async (collectionName: string, isMore = false) => {
        if (isMore) setIsPaging(true);
        else setIsLoading(true);

        try {
            const { docs, lastDoc: nextLast } = await getGenericDocuments(collectionName, 20, isMore ? lastDoc : null);
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
            // race_results doesn't have a name field at root usually, it's a map. 
            // Just return ID.
            return 'Configuration Document';
        }
        return <span className="text-highlight-silver italic">No Label</span>;
    };

    const getSecondField = (doc: any) => {
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
        // Exclude ID from the editable JSON body to prevent confusion, usually we don't change IDs
        const { id, ...data } = doc;
        setJsonContent(JSON.stringify(data, null, 2));
        setJsonError(null);
    };

    const closeEditor = () => {
        setSelectedDoc(null);
        setJsonContent('');
        setJsonError(null);
    };

    const handleSave = async () => {
        if (!selectedDoc) return;
        setIsSaving(true);
        setJsonError(null);

        try {
            const parsed = JSON.parse(jsonContent);
            await saveGenericDocument(selectedCollection, selectedDoc.id, parsed);
            showToast("Document saved successfully.", 'success');
            
            // Refresh local list state
            setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { id: selectedDoc.id, ...parsed } : d));
            closeEditor();
        } catch (error: any) {
            console.error(error);
            setJsonError(error.message || "Invalid JSON");
            showToast("Failed to save document.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedDoc) return;
        if (!window.confirm(`Are you sure you want to delete document ${selectedDoc.id}? This cannot be undone.`)) return;

        setIsSaving(true);
        try {
            await deleteGenericDocument(selectedCollection, selectedDoc.id);
            setDocuments(prev => prev.filter(d => d.id !== selectedDoc.id));
            showToast("Document deleted.", 'success');
            closeEditor();
        } catch (error) {
            console.error(error);
            showToast("Failed to delete document.", 'error');
        } finally {
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

            <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 px-4 md:px-0 pb-8">
                
                {/* Sidebar: Collections */}
                <div className="w-full md:w-64 flex-none bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-pure-white/10 bg-carbon-black/50">
                        <h3 className="text-xs font-black text-highlight-silver uppercase tracking-widest">Collections</h3>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-1">
                        {COLLECTIONS.map(col => (
                            <button
                                key={col}
                                onClick={() => setSelectedCollection(col)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                                    selectedCollection === col
                                    ? 'bg-primary-red text-pure-white shadow-lg'
                                    : 'text-highlight-silver hover:bg-pure-white/5 hover:text-pure-white'
                                }`}
                            >
                                {col}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main: Document List */}
                <div className="flex-1 bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-pure-white/10 bg-carbon-black/50 flex justify-between items-center">
                        <h3 className="text-xs font-black text-highlight-silver uppercase tracking-widest">
                            Documents <span className="text-pure-white/50">({selectedCollection})</span>
                        </h3>
                        <button 
                            onClick={() => fetchDocs(selectedCollection)} 
                            className="p-2 hover:bg-pure-white/10 rounded-full transition-colors text-highlight-silver hover:text-pure-white"
                            title="Refresh"
                        >
                            <SyncIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="p-4"><ListSkeleton /></div>
                        ) : documents.length === 0 ? (
                            <div className="p-12 text-center text-highlight-silver italic opacity-50">
                                No documents found in this collection.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-carbon-black/30 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="p-3 text-[10px] font-black uppercase text-highlight-silver tracking-widest w-1/3">ID</th>
                                        <th className="p-3 text-[10px] font-black uppercase text-highlight-silver tracking-widest w-1/3">Preview</th>
                                        <th className="p-3 text-[10px] font-black uppercase text-highlight-silver tracking-widest w-1/3 text-right">Meta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-pure-white/5">
                                    {documents.map(doc => (
                                        <tr 
                                            key={doc.id} 
                                            onClick={() => openEditor(doc)}
                                            className="hover:bg-pure-white/5 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-3 font-mono text-xs text-highlight-silver group-hover:text-primary-red transition-colors truncate max-w-[150px]">
                                                {doc.id}
                                            </td>
                                            <td className="p-3 text-sm font-bold text-pure-white truncate max-w-[200px]">
                                                {getPreviewField(doc)}
                                            </td>
                                            <td className="p-3 text-xs text-highlight-silver text-right font-mono">
                                                {getSecondField(doc)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        
                        {lastDoc && !isLoading && (
                            <div className="p-4 text-center border-t border-pure-white/10">
                                <button
                                    onClick={() => fetchDocs(selectedCollection, true)}
                                    disabled={isPaging}
                                    className="px-6 py-2 bg-carbon-black border border-pure-white/10 rounded-lg text-xs font-bold text-highlight-silver hover:text-pure-white hover:border-pure-white/30 transition-all disabled:opacity-50"
                                >
                                    {isPaging ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* JSON Editor Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in" onClick={closeEditor}>
                    <div className="bg-carbon-fiber border border-pure-white/10 rounded-xl w-full md:w-[95vw] md:max-w-[1600px] h-[85vh] md:h-[90vh] flex flex-col shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        
                        {/* Header */}
                        <div className="p-4 border-b border-pure-white/10 bg-carbon-black/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 rounded-t-xl shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-xl font-bold text-pure-white">Edit Document</h3>
                                <p className="text-xs text-highlight-silver font-mono truncate max-w-[300px] md:max-w-none">{selectedCollection} / {selectedDoc.id}</p>
                            </div>
                            <button onClick={closeEditor} className="absolute top-4 right-4 md:static text-highlight-silver hover:text-pure-white text-3xl leading-none px-2">&times;</button>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 bg-[#1e1e1e] p-0 relative overflow-hidden flex flex-col">
                            <div className="absolute top-2 right-2 z-10">
                                <button onClick={handleCopyToClipboard} className="p-2 bg-carbon-black/80 rounded hover:bg-pure-white/10 text-highlight-silver transition-colors" title="Copy JSON">
                                    <CopyIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <textarea
                                value={jsonContent}
                                onChange={(e) => {
                                    setJsonContent(e.target.value);
                                    setJsonError(null);
                                }}
                                className="w-full h-full bg-transparent text-green-400 font-mono text-sm md:text-base leading-relaxed p-4 md:p-6 outline-none resize-none"
                                spellCheck={false}
                            />
                        </div>

                        {/* Footer / Error Bar */}
                        <div className="p-4 border-t border-pure-white/10 bg-carbon-black/50 flex flex-col md:flex-row justify-between items-center gap-4 rounded-b-xl shrink-0">
                            <div className="flex-1 w-full md:w-auto">
                                {jsonError && (
                                    <p className="text-xs font-bold text-red-500 bg-red-900/20 px-3 py-2 rounded border border-red-500/30">
                                        Error: {jsonError}
                                    </p>
                                )}
                                {!jsonError && (
                                    <p className="text-xs text-highlight-silver opacity-60 text-center md:text-left">
                                        Valid JSON format required. ID cannot be changed here.
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 w-full md:w-auto justify-end">
                                <button
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                    className="px-6 py-3 md:py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold rounded-lg border border-red-500/30 text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 flex-1 md:flex-none"
                                >
                                    <TrashIcon className="w-4 h-4" /> Delete
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !!jsonError}
                                    className="px-8 py-3 md:py-2 bg-primary-red hover:bg-red-600 text-pure-white font-bold rounded-lg shadow-lg text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 flex-1 md:flex-none"
                                >
                                    {isSaving ? <SyncIcon className="animate-spin w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatabaseManagerPage;
