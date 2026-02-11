
import React, { useState, useEffect, useRef } from 'react';
import { ScoringSettingsDoc, ScoringProfile, PointsSystem } from '../types.ts';
import { saveScoringSettings } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DEFAULT_POINTS_SYSTEM } from '../constants.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';

interface ScoringSettingsPageProps {
    settings: ScoringSettingsDoc;
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'schedule' | 'invitations') => void;
}

const ScoringSettingsPage: React.FC<ScoringSettingsPageProps> = ({ settings, setAdminSubPage }) => {
    const [localSettings, setLocalSettings] = useState<ScoringSettingsDoc>(settings);
    const [editForm, setEditForm] = useState<ScoringProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();
    
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
        if (isSaving) return;
        const profile = localSettings.profiles.find(p => p.id === profileId);
        if (profile) {
            setEditForm(JSON.parse(JSON.stringify(profile)));
        }
    };

    const handleCreateNew = () => {
        if (isSaving) return;
        const newId = `profile_${Date.now()}`;
        const newProfile: ScoringProfile = {
            id: newId,
            name: 'New Custom Profile',
            config: DEFAULT_POINTS_SYSTEM
        };
        setLocalSettings(prev => ({
            ...prev,
            profiles: [...prev.profiles, newProfile]
        }));
        setEditForm(newProfile);
    };

    const handleDelete = async () => {
        if (!editForm || isSaving) return;
        if (editForm.id === localSettings.activeProfileId) {
            showToast("Cannot delete the active profile.", 'error');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete "${editForm.name}"?`)) return;

        const updatedProfiles = localSettings.profiles.filter(p => p.id !== editForm.id);
        const newSettings = { ...localSettings, profiles: updatedProfiles };
        
        setIsSaving(true);
        try {
            await saveScoringSettings(newSettings);
            setLocalSettings(newSettings);
            const active = newSettings.profiles.find(p => p.id === newSettings.activeProfileId) || newSettings.profiles[0];
            setEditForm(active ? JSON.parse(JSON.stringify(active)) : null);
            showToast("Profile deleted.", 'success');
        } catch (e) {
            console.error(e);
            showToast("Failed to delete profile.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleMakeActive = async () => {
        if (!editForm || isSaving) return;
        setIsSaving(true);
        try {
            // Internal call to save the current state of the form before activating
            let updatedProfiles = [...localSettings.profiles];
            const existingIndex = updatedProfiles.findIndex(p => p.id === editForm.id);
            if (existingIndex >= 0) {
                updatedProfiles[existingIndex] = editForm;
            } else {
                updatedProfiles.push(editForm);
            }

            const newSettings = { 
                ...localSettings, 
                profiles: updatedProfiles,
                activeProfileId: editForm.id 
            };
            
            await saveScoringSettings(newSettings);
            setLocalSettings(newSettings);
            showToast(`"${editForm.name}" is now the active scoring system.`, 'success');
        } catch (e) {
            console.error(e);
            showToast("Failed to update active profile.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async (showAlert = true) => {
        if (!editForm || isSaving) return;

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
            if (showAlert) showToast("Profile saved successfully.", 'success');
        } catch (e) {
            console.error(e);
            showToast("Failed to save profile.", 'error');
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

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    return (
        <div className="w-full max-w-4xl mx-auto text-pure-white pb-24">
            <PageHeader 
                title="SCORING SETTINGS" 
                icon={TrophyIcon} 
                leftAction={DashboardAction}
            />
            
            <div className="px-4 md:px-0 space-y-6">
                {/* Main Profile Control Card */}
                <div className="bg-carbon-fiber rounded-2xl border border-pure-white/10 p-6 shadow-2xl relative">
                    
                    {/* Row 1: Dropdown and Action Buttons */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-3 relative z-30">
                        
                        {/* Left: Dropdown */}
                        <div className="w-full md:flex-1 min-w-0">
                             <ProfileDropdown 
                                profiles={localSettings.profiles} 
                                activeProfileId={localSettings.activeProfileId}
                                selectedProfileId={editForm?.id || ''}
                                onSelect={handleProfileSelect}
                                disabled={isSaving}
                            />
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-shrink-0">
                            <button
                                onClick={handleCreateNew}
                                disabled={isSaving}
                                className="h-12 px-6 rounded-xl bg-carbon-black border border-pure-white/10 hover:bg-pure-white/5 text-pure-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                + New
                            </button>

                            <button
                                onClick={() => handleSaveProfile(true)}
                                disabled={isSaving}
                                className="h-12 w-12 flex items-center justify-center rounded-xl bg-primary-red hover:bg-red-600 text-pure-white shadow-lg shadow-primary-red/20 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent"
                                title="Save Changes"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <SaveIcon className="w-6 h-6" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Context Actions (Active/Delete) */}
                    <div className="flex items-center gap-4 px-1 h-6 relative z-20">
                        {!isActiveProfile && editForm && (
                            <>
                                <button
                                    onClick={handleMakeActive}
                                    disabled={isSaving}
                                    className="text-[10px] font-black uppercase tracking-widest text-green-500 hover:text-green-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    Make Active
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {editForm ? (
                    <div className={`space-y-6 animate-fade-in ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Profile Name Field */}
                            <div className="bg-carbon-fiber rounded-2xl border border-pure-white/10 p-6 shadow-xl flex flex-col h-full">
                                <div className="flex justify-between items-start mb-3">
                                    <label className="block text-[10px] font-black uppercase text-highlight-silver tracking-[0.2em]">Profile Name</label>
                                    {!isActiveProfile && (
                                        <button
                                            onClick={handleDelete}
                                            disabled={isSaving}
                                            className="text-highlight-silver/50 hover:text-primary-red transition-colors -mt-1 -mr-1 p-2 rounded-full hover:bg-pure-white/5"
                                            title="Delete this profile"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex-grow flex items-center">
                                    <input 
                                        type="text" 
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                        className="w-full bg-transparent border-b border-pure-white/10 focus:border-primary-red text-4xl font-black text-pure-white placeholder-pure-white/10 focus:outline-none transition-colors py-2 italic uppercase tracking-tighter"
                                        placeholder="Season 2026"
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>

                            {/* Fastest Lap Field */}
                            <div className="bg-carbon-fiber rounded-2xl border border-pure-white/10 p-6 shadow-xl flex flex-col h-full">
                                <label className="block text-[10px] font-black uppercase text-highlight-silver mb-4 tracking-[0.2em]">Fastest Lap Bonus</label>
                                <div className="flex-grow flex items-center">
                                    <div className="flex items-center gap-4 max-w-sm w-full">
                                        <div className="bg-carbon-black p-3 rounded-xl border border-pure-white/5 shadow-inner">
                                            <FastestLapIcon className="w-7 h-7 text-purple-500" />
                                        </div>
                                        <div className="flex-1 flex items-center justify-between bg-carbon-black p-3 rounded-xl border border-pure-white/5 shadow-inner group focus-within:border-primary-red/50 transition-colors">
                                            <ScoringInput 
                                                value={editForm.config.fastestLap}
                                                onChange={handleScalarChange}
                                                className="w-full bg-transparent text-2xl font-black text-pure-white focus:outline-none text-right pr-2"
                                                disabled={isSaving}
                                            />
                                            <span className="text-[10px] font-black text-highlight-silver uppercase tracking-widest ml-1">pts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* Points Grid Sections */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PointArraySection 
                                title="Grand Prix Finish" 
                                subtitle="Positions 1-10"
                                values={editForm.config.grandPrixFinish}
                                onChange={(idx, val) => handleArrayChange('grandPrixFinish', idx, val)}
                                colorClass="text-primary-red"
                                disabled={isSaving}
                            />
                            <PointArraySection 
                                title="Sprint Finish" 
                                subtitle="Positions 1-8"
                                values={editForm.config.sprintFinish}
                                onChange={(idx, val) => handleArrayChange('sprintFinish', idx, val)}
                                colorClass="text-yellow-500"
                                disabled={isSaving}
                            />
                            <PointArraySection 
                                title="GP Qualifying" 
                                subtitle="Positions 1-3"
                                values={editForm.config.gpQualifying}
                                onChange={(idx, val) => handleArrayChange('gpQualifying', idx, val)}
                                colorClass="text-blue-500"
                                disabled={isSaving}
                            />
                            <PointArraySection 
                                title="Sprint Qualifying" 
                                subtitle="Positions 1-3"
                                values={editForm.config.sprintQualifying}
                                onChange={(idx, val) => handleArrayChange('sprintQualifying', idx, val)}
                                colorClass="text-blue-400"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-highlight-silver opacity-20">
                        <TrophyIcon className="w-20 h-20 mb-4" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">Select Profile to Load Telemetry</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ProfileDropdown: React.FC<{
    profiles: ScoringProfile[];
    activeProfileId: string;
    selectedProfileId: string;
    onSelect: (id: string) => void;
    disabled?: boolean;
}> = ({ profiles, activeProfileId, selectedProfileId, onSelect, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full h-12 bg-carbon-black border border-pure-white/10 rounded-xl px-4 flex items-center justify-between hover:border-primary-red transition-all shadow-inner focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="flex items-center gap-3 truncate">
                    <span className="font-black text-xl md:text-2xl text-pure-white truncate uppercase italic tracking-tighter">{selectedProfile?.name || 'Select Profile'}</span>
                    {selectedProfileId === activeProfileId && (
                        <span className="bg-green-600/20 text-green-500 text-[10px] font-black px-2 py-1 rounded border border-green-500/30 uppercase tracking-widest">Active</span>
                    )}
                </div>
                <ChevronDownIcon className={`w-6 h-6 text-highlight-silver transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-accent-gray border border-pure-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden animate-fade-in-down origin-top">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {profiles.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { onSelect(p.id); setIsOpen(false); }}
                                className={`w-full text-left px-4 py-4 hover:bg-pure-white/5 flex items-center justify-between transition-colors border-b border-pure-white/5 last:border-none ${selectedProfileId === p.id ? 'bg-pure-white/5' : ''}`}
                            >
                                <span className="font-bold text-sm text-pure-white uppercase">{p.name}</span>
                                {p.id === activeProfileId && (
                                    <span className="bg-green-600/20 text-green-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border border-green-600/30">Active System</span>
                                )}
                            </button>
                        ))}
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
    disabled?: boolean;
}> = ({ title, subtitle, values, onChange, colorClass = "text-pure-white", disabled }) => (
    <div className={`bg-carbon-fiber rounded-2xl p-5 border border-pure-white/10 shadow-lg relative overflow-hidden group ${disabled ? 'opacity-50' : ''}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-pure-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        <div className="flex justify-between items-baseline mb-4 relative z-10">
            <h3 className={`font-black text-xs uppercase tracking-widest ${colorClass}`}>{title}</h3>
            <span className="text-[10px] text-highlight-silver/50 font-bold uppercase">{subtitle}</span>
        </div>
        <div className="grid grid-cols-5 gap-2 relative z-10">
            {values.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center bg-carbon-black/60 rounded-lg p-2 border border-pure-white/5 shadow-inner">
                    <span className="text-[8px] font-black text-highlight-silver/40 mb-1 uppercase">P{idx + 1}</span>
                    <ScoringInput 
                        value={val}
                        onChange={(newVal) => onChange(idx, newVal)}
                        className="w-full bg-transparent text-center font-black text-lg text-pure-white focus:outline-none"
                        disabled={disabled}
                    />
                </div>
            ))}
        </div>
    </div>
);

const ScoringInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    disabled?: boolean;
}> = ({ value, onChange, className, disabled }) => {
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
            disabled={disabled}
            className={`${className} appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed`}
        />
    );
};

export default ScoringSettingsPage;
