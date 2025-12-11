
import React, { useState, useEffect, useRef } from 'react';
import { ScoringSettingsDoc, ScoringProfile, PointsSystem } from '../types.ts';
import { saveScoringSettings } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DEFAULT_POINTS_SYSTEM } from '../constants.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

interface ScoringSettingsPageProps {
    settings: ScoringSettingsDoc;
    setAdminSubPage: (page: 'dashboard') => void;
}

const ScoringSettingsPage: React.FC<ScoringSettingsPageProps> = ({ settings, setAdminSubPage }) => {
    const [localSettings, setLocalSettings] = useState<ScoringSettingsDoc>(settings);
    const [editForm, setEditForm] = useState<ScoringProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Initialize with active profile or first available
    useEffect(() => {
        setLocalSettings(settings);
        if (!editForm) {
            const initialId = settings.activeProfileId || settings.profiles[0]?.id;
            const initialProfile = settings.profiles.find(p => p.id === initialId);
            if (initialProfile) {
                setEditForm(JSON.parse(JSON.stringify(initialProfile)));
            }
        }
    }, [settings]);

    const handleProfileSelect = (profileId: string) => {
        const profile = localSettings.profiles.find(p => p.id === profileId);
        if (profile) {
            setEditForm(JSON.parse(JSON.stringify(profile)));
        }
    };

    const handleCreateNew = () => {
        const newId = `profile_${Date.now()}`;
        const newProfile: ScoringProfile = {
            id: newId,
            name: 'New Custom Profile',
            config: DEFAULT_POINTS_SYSTEM
        };
        // Add to local settings immediately so it appears in dropdown
        setLocalSettings(prev => ({
            ...prev,
            profiles: [...prev.profiles, newProfile]
        }));
        setEditForm(newProfile);
    };

    const handleDelete = async () => {
        if (!editForm) return;
        if (editForm.id === localSettings.activeProfileId) {
            alert("Cannot delete the active profile.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete "${editForm.name}"?`)) return;

        const updatedProfiles = localSettings.profiles.filter(p => p.id !== editForm.id);
        const newSettings = { ...localSettings, profiles: updatedProfiles };
        
        setIsSaving(true);
        try {
            await saveScoringSettings(newSettings);
            setLocalSettings(newSettings);
            // Switch to active profile
            const active = newSettings.profiles.find(p => p.id === newSettings.activeProfileId) || newSettings.profiles[0];
            setEditForm(active ? JSON.parse(JSON.stringify(active)) : null);
        } catch (e) {
            console.error(e);
            alert("Failed to delete profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleMakeActive = async () => {
        if (!editForm) return;
        // First save any pending changes to the profile itself
        await handleSaveProfile(false); 

        const newSettings = { ...localSettings, activeProfileId: editForm.id };
        setIsSaving(true);
        try {
            await saveScoringSettings(newSettings);
            setLocalSettings(newSettings);
            alert(`"${editForm.name}" is now the active scoring system.`);
        } catch (e) {
            console.error(e);
            alert("Failed to update active profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async (showAlert = true) => {
        if (!editForm) return;

        let updatedProfiles: ScoringProfile[];
        const existingIndex = localSettings.profiles.findIndex(p => p.id === editForm.id);
        
        if (existingIndex >= 0) {
            updatedProfiles = [...localSettings.profiles];
            updatedProfiles[existingIndex] = editForm;
        } else {
            updatedProfiles = [...localSettings.profiles, editForm];
        }

        const newSettings = { ...localSettings, profiles: updatedProfiles };
        
        setIsSaving(true);
        try {
            await saveScoringSettings(newSettings);
            setLocalSettings(newSettings);
            if (showAlert) alert("Profile saved successfully.");
        } catch (e) {
            console.error(e);
            alert("Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleArrayChange = (category: keyof PointsSystem, index: number, value: number) => {
        setEditForm(prev => {
            if (!prev) return null;
            const currentArray = prev.config[category] as number[];
            const newArray = [...currentArray];
            newArray[index] = value;
            return { ...prev, config: { ...prev.config, [category]: newArray } };
        });
    };

    const handleScalarChange = (value: number) => {
        setEditForm(prev => {
            if (!prev) return null;
            return { ...prev, config: { ...prev.config, fastestLap: value } };
        });
    };

    const isActiveProfile = editForm?.id === localSettings.activeProfileId;

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:overflow-hidden text-pure-white max-w-7xl mx-auto w-full">
            
            {/* Header / Toolbar */}
            <header className="bg-accent-gray/50 backdrop-blur-md border border-pure-white/10 rounded-xl p-4 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl z-20 flex-shrink-0">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => setAdminSubPage('dashboard')}
                        className="p-2 hover:bg-pure-white/10 rounded-full transition-colors"
                        title="Back to Dashboard"
                    >
                        <BackIcon className="w-6 h-6 text-highlight-silver" />
                    </button>
                    
                    <div className="h-8 w-px bg-pure-white/10 hidden md:block"></div>

                    {/* Profile Selector */}
                    <div className="relative w-full md:w-80 z-30">
                        <ProfileDropdown 
                            profiles={localSettings.profiles} 
                            activeProfileId={localSettings.activeProfileId}
                            selectedProfileId={editForm?.id || ''}
                            onSelect={handleProfileSelect}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                     {!isActiveProfile && (
                        <button
                            onClick={handleDelete}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-bold text-highlight-silver hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            Delete
                        </button>
                    )}
                    
                    <button
                        onClick={handleCreateNew}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-bold text-highlight-silver hover:text-pure-white hover:bg-pure-white/10 rounded-lg transition-colors whitespace-nowrap"
                    >
                        + New
                    </button>

                    {!isActiveProfile && (
                        <button
                            onClick={handleMakeActive}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-bold text-green-400 border border-green-400/30 hover:bg-green-400/10 rounded-lg transition-colors whitespace-nowrap"
                        >
                            Make Active
                        </button>
                    )}

                    <button
                        onClick={() => handleSaveProfile(true)}
                        disabled={isSaving}
                        className="px-6 py-2 bg-primary-red hover:bg-red-600 text-pure-white font-bold rounded-lg shadow-lg shadow-primary-red/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            {/* Main Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto bg-carbon-black/30 rounded-xl border border-pure-white/5 p-6 md:p-8 custom-scrollbar">
                {editForm ? (
                    <div className="max-w-5xl mx-auto space-y-8">
                        
                        {/* Title & Meta */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end border-b border-pure-white/10 pb-6">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-2 tracking-wider">Profile Name</label>
                                <input 
                                    type="text" 
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                    className="w-full bg-transparent border-b-2 border-accent-gray focus:border-primary-red text-3xl font-bold text-pure-white placeholder-pure-white/20 focus:outline-none transition-colors py-2"
                                    placeholder="Enter profile name..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-2 tracking-wider">Fastest Lap Bonus</label>
                                <div className="flex items-center gap-3 bg-accent-gray/30 p-2 rounded-lg border border-pure-white/5">
                                    <FastestLapIcon className="w-8 h-8 text-purple-500" />
                                    <div className="flex-1">
                                         <ScoringInput 
                                            value={editForm.config.fastestLap}
                                            onChange={handleScalarChange}
                                            className="w-full bg-transparent text-xl font-bold text-pure-white focus:outline-none text-right"
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-highlight-silver pr-2">pts</span>
                                </div>
                            </div>
                        </div>

                        {/* Points Grid */}
                        <div className="space-y-8">
                            
                            {/* Row 1: Race Finishes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <PointArraySection 
                                    title="Grand Prix Finish" 
                                    subtitle="Positions 1-10"
                                    values={editForm.config.grandPrixFinish}
                                    onChange={(idx, val) => handleArrayChange('grandPrixFinish', idx, val)}
                                    colorClass="text-primary-red"
                                />
                                <PointArraySection 
                                    title="Sprint Finish" 
                                    subtitle="Positions 1-8"
                                    values={editForm.config.sprintFinish}
                                    onChange={(idx, val) => handleArrayChange('sprintFinish', idx, val)}
                                    colorClass="text-yellow-500"
                                />
                            </div>

                            {/* Row 2: Quali */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <PointArraySection 
                                    title="GP Qualifying" 
                                    subtitle="Positions 1-3"
                                    values={editForm.config.gpQualifying}
                                    onChange={(idx, val) => handleArrayChange('gpQualifying', idx, val)}
                                    colorClass="text-blue-500"
                                />
                                <PointArraySection 
                                    title="Sprint Qualifying" 
                                    subtitle="Positions 1-3"
                                    values={editForm.config.sprintQualifying}
                                    onChange={(idx, val) => handleArrayChange('sprintQualifying', idx, val)}
                                    colorClass="text-blue-400"
                                />
                            </div>

                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-highlight-silver opacity-50">
                        <TrophyIcon className="w-24 h-24 mb-4" />
                        <p className="text-xl">Select or create a profile to edit settings.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-Components ---

const ProfileDropdown: React.FC<{
    profiles: ScoringProfile[];
    activeProfileId: string;
    selectedProfileId: string;
    onSelect: (id: string) => void;
}> = ({ profiles, activeProfileId, selectedProfileId, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredProfiles = profiles.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-carbon-black border border-accent-gray rounded-lg py-2 px-4 flex items-center justify-between hover:border-highlight-silver transition-colors focus:ring-2 focus:ring-primary-red focus:outline-none"
            >
                <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-pure-white truncate">{selectedProfile?.name || 'Select Profile'}</span>
                    {selectedProfileId === activeProfileId && (
                        <span className="bg-green-600 text-pure-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Active</span>
                    )}
                </div>
                <ChevronDownIcon className="w-4 h-4 text-highlight-silver" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-accent-gray border border-pure-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-pure-white/5">
                        <input 
                            type="text" 
                            placeholder="Find profile..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-carbon-black/50 border-none rounded px-2 py-1 text-sm text-pure-white focus:ring-0 placeholder-pure-white/30"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredProfiles.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { onSelect(p.id); setIsOpen(false); setSearch(''); }}
                                className={`w-full text-left px-4 py-3 hover:bg-pure-white/5 flex items-center justify-between transition-colors ${selectedProfileId === p.id ? 'bg-pure-white/5' : ''}`}
                            >
                                <span className="font-medium text-sm text-pure-white truncate">{p.name}</span>
                                {p.id === activeProfileId && (
                                    <span className="bg-green-600/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-green-600/30">Active</span>
                                )}
                            </button>
                        ))}
                        {filteredProfiles.length === 0 && (
                            <div className="px-4 py-3 text-sm text-highlight-silver italic text-center">No profiles found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const PointArraySection: React.FC<{
    title: string;
    subtitle: string;
    values: number[];
    onChange: (index: number, value: number) => void;
    colorClass?: string;
}> = ({ title, subtitle, values, onChange, colorClass = "text-pure-white" }) => (
    <div className="bg-accent-gray/20 rounded-lg p-5 border border-pure-white/5 hover:border-pure-white/10 transition-colors">
        <div className="flex justify-between items-baseline mb-4">
            <h3 className={`font-bold text-lg ${colorClass}`}>{title}</h3>
            <span className="text-xs text-highlight-silver font-mono">{subtitle}</span>
        </div>
        <div className="flex flex-wrap gap-2">
            {values.map((val, idx) => (
                <div key={idx} className="flex-1 min-w-[3.5rem] flex flex-col items-center bg-carbon-black/40 rounded-md p-1 border border-pure-white/5">
                    <span className="text-[10px] font-bold text-highlight-silver/70 mb-1">P{idx + 1}</span>
                    <ScoringInput 
                        value={val}
                        onChange={(newVal) => onChange(idx, newVal)}
                        className="w-full bg-transparent text-center font-bold text-lg text-pure-white focus:outline-none"
                    />
                </div>
            ))}
        </div>
    </div>
);

// Custom Input to remove spinners and handle raw strings
const ScoringInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
}> = ({ value, onChange, className }) => {
    const [localStr, setLocalStr] = useState(value.toString());

    useEffect(() => {
        setLocalStr(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        if (newVal === '') {
            setLocalStr('');
            onChange(0);
            return;
        }
        if (/^\d*$/.test(newVal)) {
            const cleanStr = newVal.replace(/^0+/, '') || '0';
            setLocalStr(cleanStr);
            onChange(parseInt(cleanStr, 10));
        }
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={localStr}
            onChange={handleChange}
            onFocus={(e) => e.target.select()}
            className={`${className} appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
    );
};

const FastestLapIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M15,1H9v2h6V1M12,5.5A7.5,7.5 0 0,0 4.5,13A7.5,7.5 0 0,0 12,20.5A7.5,7.5 0 0,0 19.5,13A7.5,7.5 0 0,0 12,5.5M12,7A6,6 0 0,1 18,13A6,6 0 0,1 12,19A6,6 0 0,1 6,13A6,6 0 0,1 12,7m-.5,2V12.5l3.5,2l.8-1.2l-2.8-1.6V9H11.5Z" />
  </svg>
);

export default ScoringSettingsPage;
