
import React, { useState, useEffect } from 'react';
import { PointsSystem } from '../types.ts';
import { savePointsSystem } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';

interface ScoringSettingsPageProps {
    currentConfig: PointsSystem;
    setAdminSubPage: (page: 'dashboard') => void;
}

const ScoringSettingsPage: React.FC<ScoringSettingsPageProps> = ({ currentConfig, setAdminSubPage }) => {
    const [config, setConfig] = useState<PointsSystem>(currentConfig);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setConfig(currentConfig);
    }, [currentConfig]);

    const handleArrayChange = (
        category: keyof PointsSystem,
        index: number,
        value: string
    ) => {
        if (value.length > 4) return;
        const numValue = parseInt(value) || 0;
        setConfig(prev => {
            const currentArray = prev[category] as number[];
            const newArray = [...currentArray];
            newArray[index] = numValue;
            return { ...prev, [category]: newArray };
        });
    };

    const handleScalarChange = (value: string) => {
        if (value.length > 4) return;
        const numValue = parseInt(value) || 0;
        setConfig(prev => ({ ...prev, fastestLap: numValue }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await savePointsSystem(config);
            alert("Scoring configuration updated successfully.");
        } catch (error) {
            console.error(error);
            alert("Failed to save configuration.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto text-pure-white">
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

            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 space-y-8">
                <div>
                    <h2 className="text-xl font-bold mb-4 text-primary-red">Fastest Lap Bonus</h2>
                    <div className="flex items-center gap-4">
                         <label className="text-sm font-bold text-highlight-silver">Points:</label>
                         <input 
                            type="number" 
                            value={config.fastestLap}
                            onChange={(e) => handleScalarChange(e.target.value)}
                            max="9999"
                            className="w-24 bg-carbon-black border border-accent-gray rounded-md py-2 px-3 text-pure-white focus:ring-primary-red focus:border-primary-red"
                        />
                    </div>
                </div>

                <PointArraySection 
                    title="Grand Prix Finish Points (P1 - P10)" 
                    values={config.grandPrixFinish}
                    onChange={(idx, val) => handleArrayChange('grandPrixFinish', idx, val)}
                />

                <PointArraySection 
                    title="Sprint Finish Points (P1 - P8)" 
                    values={config.sprintFinish}
                    onChange={(idx, val) => handleArrayChange('sprintFinish', idx, val)}
                />
                
                <PointArraySection 
                    title="Qualifying Points (P1 - P3)" 
                    values={config.gpQualifying}
                    onChange={(idx, val) => handleArrayChange('gpQualifying', idx, val)}
                />

                <PointArraySection 
                    title="Sprint Qualifying Points (P1 - P3)" 
                    values={config.sprintQualifying}
                    onChange={(idx, val) => handleArrayChange('sprintQualifying', idx, val)}
                />

                <div className="pt-6 border-t border-accent-gray/50 flex justify-end">
                     <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-8 rounded-lg disabled:bg-accent-gray disabled:cursor-wait"
                    >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PointArraySection: React.FC<{
    title: string;
    values: number[];
    onChange: (index: number, value: string) => void;
}> = ({ title, values, onChange }) => (
    <div>
        <h2 className="text-xl font-bold mb-4 text-primary-red">{title}</h2>
        <div className="flex flex-wrap gap-3">
            {values.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center">
                    <label className="text-xs text-highlight-silver mb-1">P{idx + 1}</label>
                    <input 
                        type="number" 
                        value={val}
                        onChange={(e) => onChange(idx, e.target.value)}
                        max="9999"
                        className="w-16 bg-carbon-black border border-accent-gray rounded-md py-2 px-2 text-center text-pure-white focus:ring-primary-red focus:border-primary-red"
                    />
                </div>
            ))}
        </div>
    </div>
);

export default ScoringSettingsPage;
