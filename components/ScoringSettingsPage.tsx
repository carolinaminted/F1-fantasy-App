
import React, { useState, useEffect } from 'react';
import { ScoringSettingsDoc, ScoringProfile, PointsSystem } from '../types.ts';
import { saveScoringSettings } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DEFAULT_POINTS_SYSTEM } from '../constants.ts';

interface ScoringSettingsPageProps {
    settings: ScoringSettingsDoc;
    setAdminSubPage: (page: 'dashboard') => void;
}

const ScoringSettingsPage: React.FC<ScoringSettingsPageProps> = ({ settings, setAdminSubPage }) => {
    const [localSettings, setLocalSettings] = useState<ScoringSettingsDoc>(settings);
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form state for profile editing
    const [editForm, setEditForm] = useState<ScoringProfile | null>(null);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleProfileSelect = (profileId: string) => {
        const profile = localSettings.profiles.find(p => p.id === profileId);
        if (profile) {
            setEditForm(JSON.parse(JSON.stringify(profile))); // Deep copy
            setEditingProfileId(profileId);
        }
    };

    const handleCreateNew = () => {
        const newId = `profile_${Date.now()}`;
        const newProfile: ScoringProfile = {
            id: newId,
            name: 'New Profile',
            config: DEFAULT_POINTS_SYSTEM
        };
        setEditForm(newProfile);
        setEditingProfileId(newId);
    };

    const handleDelete = async (profileId: string) => {
        if (profileId === localSettings.activeProfileId) {
            alert("Cannot delete the active profile.");
            return;
        }
        if (!window.confirm("Are you sure you want to delete this profile?")) return;

        const updatedProfiles = localSettings.profiles.filter(p => p.id !== profileId);
        const newSettings = { ...localSettings, profiles: updatedProfiles };
        
        setIsSaving(true);
        try {
            await saveScoringSettings(newSettings);
            setLocalSettings(newSettings);
            if (editingProfileId === profileId) {
                setEditingProfileId(null);
                setEditForm(null);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to delete profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleMakeActive = async (profileId: string) => {
        const newSettings = { ...localSettings, activeProfileId: profileId };
        setIsSaving(true);
        try {
            await saveScoringSettings(newSettings);
            setLocalSettings(newSettings);
        } catch (e) {
            console.error(e);
            alert("Failed to update active profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async () => {
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
            alert("Profile saved successfully.");
        } catch (e) {
            console.error(e);
            alert("Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleArrayChange = (
        category: keyof PointsSystem,
        index: number,
        value: number
    ) => {
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

    return (
        <div className="max-w-6xl mx-auto text-pure-white">
             <div className="flex items-center justify-between mb-8">
                 <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-right">
                    Scoring Settings <TrophyIcon className="w-8 h-8"/>
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Profile List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-4 ring-1 ring-pure-white/10">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-pure-white">Profiles</h2>
                            <button 
                                onClick={handleCreateNew}
                                className="bg-blue-600 hover:bg-blue-500 text-xs font-bold py-1 px-3 rounded text-pure-white"
                            >
                                + New
                            </button>
                        </div>
                        <div className="space-y-3">
                            {localSettings.profiles.map(profile => {
                                const isActive = localSettings.activeProfileId === profile.id;
                                const isEditing = editingProfileId === profile.id;
                                return (
                                    <div 
                                        key={profile.id}
                                        onClick={() => handleProfileSelect(profile.id)}
                                        className={`p-3 rounded-lg cursor-pointer border transition-all ${
                                            isEditing 
                                            ? 'bg-carbon-black border-primary-red shadow-lg' 
                                            : 'bg-carbon-black/40 border-accent-gray hover:border-highlight-silver'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-sm">{profile.name}</span>
                                            {isActive && <span className="bg-green-600 text-pure-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Active</span>}
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            {!isActive && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleMakeActive(profile.id); }}
                                                    disabled={isSaving}
                                                    className="text-[10px] bg-accent-gray hover:bg-green-700 hover:text-white px-2 py-1 rounded text-highlight-silver transition-colors"
                                                >
                                                    Make Active
                                                </button>
                                            )}
                                            {!isActive && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(profile.id); }}
                                                    disabled={isSaving}
                                                    className="text-[10px] bg-accent-gray hover:bg-red-900 hover:text-white px-2 py-1 rounded text-highlight-silver transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Editor */}
                <div className="lg:col-span-2">
                    {editForm ? (
                        <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 space-y-6">
                            <div className="flex justify-between items-center border-b border-accent-gray/50 pb-4">
                                <h2 className="text-xl font-bold text-pure-white">
                                    Editing: <span className="text-primary-red">{editForm.name}</span>
                                </h2>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isSaving}
                                    className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg disabled:bg-accent-gray disabled:cursor-wait"
                                >
                                    {isSaving ? 'Saving...' : 'Save Profile'}
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Profile Name</label>
                                <input 
                                    type="text" 
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                    className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                />
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-bold text-highlight-silver mb-2">Fastest Lap Bonus</h3>
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold text-ghost-white">Points:</label>
                                        <ScoringInput 
                                            value={editForm.config.fastestLap}
                                            onChange={handleScalarChange}
                                            className="w-24 bg-carbon-black border border-accent-gray rounded-md py-2 px-3 text-pure-white focus:ring-primary-red focus:border-primary-red text-center font-bold"
                                        />
                                    </div>
                                </div>

                                <PointArraySection 
                                    title="Grand Prix Finish (P1 - P10)" 
                                    values={editForm.config.grandPrixFinish}
                                    onChange={(idx, val) => handleArrayChange('grandPrixFinish', idx, val)}
                                />

                                <PointArraySection 
                                    title="Sprint Finish (P1 - P8)" 
                                    values={editForm.config.sprintFinish}
                                    onChange={(idx, val) => handleArrayChange('sprintFinish', idx, val)}
                                />
                                
                                <PointArraySection 
                                    title="Qualifying (P1 - P3)" 
                                    values={editForm.config.gpQualifying}
                                    onChange={(idx, val) => handleArrayChange('gpQualifying', idx, val)}
                                />

                                <PointArraySection 
                                    title="Sprint Qualifying (P1 - P3)" 
                                    values={editForm.config.sprintQualifying}
                                    onChange={(idx, val) => handleArrayChange('sprintQualifying', idx, val)}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center bg-accent-gray/20 rounded-lg border-2 border-dashed border-accent-gray p-12">
                            <p className="text-highlight-silver">Select a profile to edit or create a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const PointArraySection: React.FC<{
    title: string;
    values: number[];
    onChange: (index: number, value: number) => void;
}> = ({ title, values, onChange }) => (
    <div>
        <h3 className="font-bold text-highlight-silver mb-2">{title}</h3>
        <div className="flex flex-wrap gap-3">
            {values.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center">
                    <label className="text-[10px] text-highlight-silver mb-1">P{idx + 1}</label>
                    <ScoringInput 
                        value={val}
                        onChange={(newVal) => onChange(idx, newVal)}
                        className="w-14 bg-carbon-black border border-accent-gray rounded-md py-1 px-1 text-center text-sm text-pure-white focus:ring-primary-red focus:border-primary-red"
                    />
                </div>
            ))}
        </div>
    </div>
);

// Enhanced Input Component
const ScoringInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
}> = ({ value, onChange, className }) => {
    // Local string state to handle empty inputs or typing
    const [localStr, setLocalStr] = useState(value.toString());

    // Sync local state if parent value changes externally
    useEffect(() => {
        setLocalStr(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        // Allow empty string to let user clear input
        if (newVal === '') {
            setLocalStr('');
            onChange(0); // Optional: treat empty as 0 in state, or handle validity elsewhere
            return;
        }

        // Only allow numeric input
        if (/^\d*$/.test(newVal)) {
            // Remove leading zeros for display, unless it's just "0"
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
            onFocus={(e) => e.target.select()} // Seamless select on click
            className={`${className} appearance-none`} // Ensure CSS reset
        />
    );
};

export default ScoringSettingsPage;
