
import React, { useState, useEffect } from 'react';
import { Event, EventResult, Driver } from '../types.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

interface ResultsFormProps {
    event: Event;
    currentResults?: EventResult;
    onSave: (eventId: string, results: EventResult) => Promise<boolean>;
    allDrivers: Driver[];
    isLocked: boolean;
    onToggleLock: () => void;
}

const emptyResults = (event: Event): EventResult => ({
    grandPrixFinish: Array(10).fill(null),
    gpQualifying: Array(3).fill(null),
    fastestLap: null,
    ...(event.hasSprint && {
        sprintFinish: Array(8).fill(null),
        sprintQualifying: Array(3).fill(null),
    }),
});

const ResultsForm: React.FC<ResultsFormProps> = ({ event, currentResults, onSave, allDrivers, isLocked, onToggleLock }) => {
    const [results, setResults] = useState<EventResult>(currentResults || emptyResults(event));
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
    // Default to null so both are collapsed initially
    const [activeSession, setActiveSession] = useState<'gp' | 'sprint' | null>(null);

    useEffect(() => {
        setResults(currentResults || emptyResults(event));
        setSaveState('idle'); 
        // Reset to collapsed (null) whenever the event changes
        setActiveSession(null); 
    }, [currentResults, event]);

    const handleSelect = (category: keyof EventResult, value: string | null, index: number) => {
        setResults(prev => {
            const newResults = { ...prev };
            const field = newResults[category];
            if (Array.isArray(field)) {
                const newArray = [...field];
                newArray[index] = value;
                (newResults as any)[category] = newArray;
            }
            return newResults;
        });
    };

    const handleFastestLapSelect = (value: string | null) => {
        setResults(prev => ({ ...prev, fastestLap: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveState('saving');
        const success = await onSave(event.id, results);
        if (success) {
            setSaveState('success');
            setTimeout(() => setSaveState('idle'), 2000);
        } else {
            setSaveState('idle'); 
        }
    };

    const driverOptions = allDrivers.map(d => ({ value: d.id, label: d.name }));

    const buttonContent = {
        idle: 'Save Results',
        saving: 'Saving...',
        success: '✓ Saved',
    };

    const buttonClasses = {
        idle: 'bg-primary-red hover:opacity-90',
        saving: 'bg-accent-gray cursor-wait',
        success: 'bg-green-600',
    };

    // Responsive Grid: 1 column on mobile, 12 columns on large screens
    // Mobile height: auto (grow). Desktop height: full (fit).
    const renderGpContent = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-auto md:h-full">
            {/* Quali Section */}
            <div className="lg:col-span-3 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-2">Qualifying</h4>
                <div className="bg-carbon-black/20 rounded-lg p-3 flex-1">
                    <ResultGroup
                        positions={3}
                        selected={results.gpQualifying}
                        onSelect={(val, idx) => handleSelect('gpQualifying', val, idx)}
                        options={driverOptions}
                        cols={1}
                    />
                </div>
            </div>
            {/* Race Section */}
            <div className="lg:col-span-9 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-2">Race Results</h4>
                <div className="bg-carbon-black/20 rounded-lg p-3 flex-1">
                    <ResultGroup
                        positions={10}
                        selected={results.grandPrixFinish}
                        onSelect={(val, idx) => handleSelect('grandPrixFinish', val, idx)}
                        options={driverOptions}
                        cols={2} // Switch ResultGroup internal cols based on logic below
                    />
                </div>
            </div>
        </div>
    );

    const renderSprintContent = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-auto md:h-full">
             {/* Sprint Quali */}
            <div className="lg:col-span-3 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-2">Sprint Quali</h4>
                <div className="bg-carbon-black/20 rounded-lg p-3 flex-1">
                    <ResultGroup
                        positions={3}
                        selected={results.sprintQualifying || []}
                        onSelect={(val, idx) => handleSelect('sprintQualifying', val, idx)}
                        options={driverOptions}
                        cols={1}
                    />
                </div>
            </div>
            {/* Sprint Race */}
            <div className="lg:col-span-9 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-2">Sprint Results</h4>
                <div className="bg-carbon-black/20 rounded-lg p-3 flex-1">
                    <ResultGroup
                        positions={8}
                        selected={results.sprintFinish || []}
                        onSelect={(val, idx) => handleSelect('sprintFinish', val, idx)}
                        options={driverOptions}
                        cols={2}
                    />
                </div>
            </div>
        </div>
    );

    const AccordionHeader: React.FC<{ 
        title: string; 
        icon: React.FC<any>; 
        isActive: boolean; 
        onClick: () => void 
    }> = ({ title, icon: Icon, isActive, onClick }) => (
        <button 
            type="button"
            onClick={onClick}
            className={`w-full flex items-center justify-between p-3 rounded-t-xl transition-colors border border-pure-white/5 ${
                isActive 
                ? 'bg-carbon-black/60 text-pure-white border-b-transparent' 
                : 'bg-carbon-black/20 text-highlight-silver hover:bg-carbon-black/40'
            } ${!isActive ? 'rounded-b-xl mb-2' : ''}`}
        >
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-red' : 'text-highlight-silver'}`} />
                <span className="font-bold text-sm uppercase tracking-wider">{title}</span>
            </div>
            <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} />
        </button>
    );

    return (
        // Mobile: h-auto (flow), Desktop: h-full + overflow hidden
        <form onSubmit={handleSubmit} className="text-pure-white flex flex-col md:h-full md:overflow-hidden">
            {/* Header: Sticky on Mobile to keep actions visible */}
            <div className="sticky top-0 z-20 bg-carbon-black md:relative md:top-auto md:z-auto md:bg-transparent flex flex-wrap md:flex-nowrap justify-between items-center mb-2 md:mb-4 pb-2 border-b border-accent-gray/50 flex-shrink-0 gap-y-3 pt-2 md:pt-0 shadow-md md:shadow-none">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-bold truncate">{event.name}</h2>
                            {isLocked && (
                                <span className="bg-primary-red/20 text-primary-red px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-primary-red/20">
                                    Locked
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-highlight-silver">{event.country} • Round {event.round}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                     {/* Fastest Lap Input */}
                     <div className="flex-1 md:flex-none md:pl-4 md:border-l border-accent-gray/50">
                        <label className="text-[10px] font-bold text-primary-red uppercase block mb-0.5">Fastest Lap</label>
                        <div className="w-full md:w-40">
                             <SelectDriver
                                value={results.fastestLap}
                                onChange={handleFastestLapSelect}
                                options={driverOptions}
                                label=""
                                placeholder="Select FL..."
                                compact={true}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onToggleLock}
                            className={`font-bold py-1.5 px-3 rounded text-xs border transition-colors h-[34px] ${
                                isLocked 
                                ? 'bg-transparent border-green-600 text-green-500 hover:bg-green-600/10' 
                                : 'bg-transparent border-primary-red text-primary-red hover:bg-primary-red/10'
                            }`}
                        >
                            {isLocked ? 'Unlock' : 'Lock'}
                        </button>

                        <button
                            type="submit"
                            disabled={saveState !== 'idle'}
                            className={`font-bold py-1.5 px-4 rounded text-xs text-pure-white transition-colors min-w-[100px] h-[34px] ${buttonClasses[saveState]}`}
                        >
                            {buttonContent[saveState]}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            {/* Mobile: Standard vertical flow. Desktop: Flex-1, scrollable interior */}
            <div className="md:flex-1 md:min-h-0 md:flex md:flex-col md:overflow-y-auto">
                
                {!event.hasSprint ? (
                    /* Standard Layout for Non-Sprint Events */
                    <section className="flex-none lg:flex-1 bg-carbon-black/40 rounded-xl p-4 border border-pure-white/5 flex flex-col">
                        <div className="flex items-center gap-2 mb-4 border-b border-accent-gray/30 pb-2 flex-shrink-0">
                             <CheckeredFlagIcon className="w-5 h-5 text-primary-red" />
                             <h3 className="font-bold text-sm uppercase tracking-wider text-pure-white">Grand Prix Session</h3>
                        </div>
                        <div className="flex-1">
                            {renderGpContent()}
                        </div>
                    </section>
                ) : (
                    /* Accordion Layout for Sprint Events */
                    <>
                        {/* GP Section */}
                        <div className={`flex flex-col transition-all duration-300 ${activeSession === 'gp' ? 'flex-none lg:flex-1' : 'flex-none'}`}>
                            <AccordionHeader 
                                title="Grand Prix Session" 
                                icon={CheckeredFlagIcon} 
                                isActive={activeSession === 'gp'} 
                                onClick={() => setActiveSession(activeSession === 'gp' ? null : 'gp')} 
                            />
                            {activeSession === 'gp' && (
                                <div className="flex-1 bg-carbon-black/40 border-x border-b border-pure-white/5 p-4 rounded-b-xl mb-2 min-h-0">
                                    {renderGpContent()}
                                </div>
                            )}
                        </div>

                        {/* Sprint Section */}
                        <div className={`flex flex-col transition-all duration-300 ${activeSession === 'sprint' ? 'flex-none lg:flex-1' : 'flex-none'}`}>
                            <AccordionHeader 
                                title="Sprint Session" 
                                icon={SprintIcon} 
                                isActive={activeSession === 'sprint'} 
                                onClick={() => setActiveSession(activeSession === 'sprint' ? null : 'sprint')} 
                            />
                            {activeSession === 'sprint' && (
                                <div className="flex-1 bg-carbon-black/40 border-x border-b border-pure-white/5 p-4 rounded-b-xl mb-2 min-h-0">
                                    {renderSprintContent()}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </form>
    );
};

interface ResultGroupProps {
    positions: number;
    selected: (string | null)[];
    onSelect: (value: string | null, index: number) => void;
    options: { value: string; label: string }[];
    cols?: number;
}

const ResultGroup: React.FC<ResultGroupProps> = ({ positions, selected, onSelect, options, cols = 1 }) => {
    // Dynamic cols: If 2 cols requested, stack to 1 on mobile, 2 on md
    const gridClass = cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';
    
    return (
        <div className={`grid gap-x-4 gap-y-2 h-auto md:h-full content-start ${gridClass}`}>
            {Array.from({ length: positions }).map((_, i) => {
                const otherSelectedIds = selected.filter((id, index) => index !== i && id !== null);
                return (
                    <SelectDriver
                        key={i}
                        value={selected[i]}
                        onChange={(val) => onSelect(val, i)}
                        options={options}
                        label={`P${i + 1}`}
                        disabledIds={otherSelectedIds}
                        compact={true}
                    />
                );
            })}
        </div>
    );
};

interface SelectDriverProps {
    value: string | null;
    onChange: (value: string | null) => void;
    options: { value: string; label: string }[];
    label: string;
    disabledIds?: (string | null)[];
    placeholder?: string;
    compact?: boolean;
}

const SelectDriver: React.FC<SelectDriverProps> = ({ value, onChange, options, label, disabledIds = [], placeholder = "Select...", compact }) => (
    <div className="flex items-center gap-2">
        {label && <label className="w-5 text-xs font-bold text-highlight-silver text-right">{label}</label>}
        <div className="relative w-full">
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value || null)}
                className={`w-full bg-carbon-black border border-accent-gray rounded px-2 text-pure-white focus:outline-none focus:ring-1 focus:ring-primary-red focus:border-primary-red appearance-none truncate ${compact ? 'py-1 text-xs h-8' : 'py-2 text-sm'}`}
            >
                <option value="">{placeholder}</option>
                {options.map(opt => (
                    <option 
                        key={opt.value} 
                        value={opt.value}
                        disabled={disabledIds.includes(opt.value)}
                    >
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    </div>
);

export default ResultsForm;
