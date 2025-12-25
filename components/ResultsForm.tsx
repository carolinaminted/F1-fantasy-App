import React, { useState, useEffect, useMemo } from 'react';
import { Event, EventResult, Driver, Constructor } from '../types.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { SelectorCard } from './PicksForm.tsx';
import { CONSTRUCTORS } from '../constants.ts';

interface ResultsFormProps {
    event: Event;
    currentResults?: EventResult;
    onSave: (eventId: string, results: EventResult) => Promise<boolean>;
    allDrivers: Driver[];
    allConstructors: Constructor[];
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

const ResultsForm: React.FC<ResultsFormProps> = ({ event, currentResults, onSave, allDrivers, allConstructors, isLocked, onToggleLock }) => {
    const [results, setResults] = useState<EventResult>(currentResults || emptyResults(event));
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
    // Set 'gp' as default so the Grand Prix section is expanded on load for sprint weekends
    const [activeSession, setActiveSession] = useState<'gp' | 'sprint' | null>('gp');
    const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);

    useEffect(() => {
        setResults(currentResults || emptyResults(event));
        setSaveState('idle'); 
        // Ensure reset to 'gp' when the event or current results change
        setActiveSession('gp'); 
    }, [currentResults, event]);

    const sortedDrivers = useMemo(() => {
        return [...allDrivers].sort((a, b) => {
            const getRank = (id: string) => {
                const idx = CONSTRUCTORS.findIndex(c => c.id === id);
                return idx === -1 ? 999 : idx;
            };
            const teamAIndex = getRank(a.constructorId);
            const teamBIndex = getRank(b.constructorId);
            if (teamAIndex !== teamBIndex) return teamAIndex - teamBIndex;
            return a.name.localeCompare(b.name);
        });
    }, [allDrivers]);

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

    const openDriverModal = (category: keyof EventResult, index: number, title: string, disabledIds: (string | null)[] = []) => {
        const handleSelection = (driverId: string | null) => {
            if (category === 'fastestLap') {
                handleFastestLapSelect(driverId);
            } else {
                handleSelect(category, driverId, index);
            }
            setModalContent(null);
        };

        const currentSelection = category === 'fastestLap' ? results.fastestLap : (results[category] as (string | null)[])[index];

        const modalBody = (
            <div className="p-6">
                <div className="text-center mb-6">
                    <h4 className="text-2xl font-bold text-pure-white">{title}</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div
                        onClick={() => handleSelection(null)}
                        className="p-1.5 rounded-lg border-2 border-accent-gray bg-carbon-black/50 hover:border-highlight-silver cursor-pointer flex items-center justify-center min-h-[3.5rem] text-highlight-silver font-bold italic"
                    >
                        Clear Selection
                    </div>
                    {sortedDrivers.map(driver => {
                        const isAlreadyUsed = disabledIds.includes(driver.id) && driver.id !== currentSelection;
                        let constructor = allConstructors.find(c => c.id === driver.constructorId) || CONSTRUCTORS.find(c => c.id === driver.constructorId);
                        const color = constructor?.color;

                        return (
                            <SelectorCard
                                key={driver.id}
                                option={driver}
                                isSelected={currentSelection === driver.id}
                                onClick={() => handleSelection(driver.id)}
                                placeholder="Driver"
                                disabled={isAlreadyUsed}
                                color={color}
                                forceColor={true}
                            />
                        );
                    })}
                </div>
            </div>
        );
        setModalContent(modalBody);
    };

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

    const renderGpContent = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Qualifying</h4>
                <div className="bg-carbon-black/20 rounded-lg p-4">
                    <ResultGroup
                        positions={3}
                        selected={results.gpQualifying}
                        onTrigger={(idx) => openDriverModal('gpQualifying', idx, `Qualifying P${idx + 1}`, results.gpQualifying)}
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
                        cols={1}
                    />
                </div>
            </div>
            <div className="lg:col-span-9 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Race Results</h4>
                <div className="bg-carbon-black/20 rounded-lg p-4">
                    <ResultGroup
                        positions={10}
                        selected={results.grandPrixFinish}
                        onTrigger={(idx) => openDriverModal('grandPrixFinish', idx, `Grand Prix P${idx + 1}`, results.grandPrixFinish)}
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
                        cols={2}
                    />
                </div>
            </div>
        </div>
    );

    const renderSprintContent = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Sprint Quali</h4>
                <div className="bg-carbon-black/20 rounded-lg p-4">
                    <ResultGroup
                        positions={3}
                        selected={results.sprintQualifying || []}
                        onTrigger={(idx) => openDriverModal('sprintQualifying', idx, `Sprint Quali P${idx + 1}`, results.sprintQualifying || [])}
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
                        cols={1}
                    />
                </div>
            </div>
            <div className="lg:col-span-9 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Sprint Results</h4>
                <div className="bg-carbon-black/20 rounded-lg p-4">
                    <ResultGroup
                        positions={8}
                        selected={results.sprintFinish || []}
                        onTrigger={(idx) => openDriverModal('sprintFinish', idx, `Sprint P${idx + 1}`, results.sprintFinish || [])}
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
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
            className={`w-full flex items-center justify-between p-4 rounded-t-xl transition-colors border border-pure-white/5 ${
                isActive 
                ? 'bg-carbon-black/60 text-pure-white border-b-transparent' 
                : 'bg-carbon-black/20 text-highlight-silver hover:bg-carbon-black/40'
            } ${!isActive ? 'rounded-b-xl mb-4' : ''}`}
        >
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-red' : 'text-highlight-silver'}`} />
                <span className="font-bold text-sm uppercase tracking-wider">{title}</span>
            </div>
            <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} />
        </button>
    );

    const selectedFLDriver = allDrivers.find(d => d.id === results.fastestLap) || null;
    let flColor = undefined;
    if (selectedFLDriver) {
        const cId = selectedFLDriver.constructorId;
        flColor = allConstructors.find(c => c.id === cId)?.color || CONSTRUCTORS.find(c => c.id === cId)?.color;
    }

    return (
        <div className="text-pure-white flex flex-col min-h-0">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
                <div className="sticky top-0 z-20 bg-carbon-black md:relative md:top-auto md:z-auto md:bg-transparent flex flex-wrap md:flex-nowrap justify-between items-end mb-4 pb-4 border-b border-accent-gray/50 flex-shrink-0 gap-y-3 pt-2 md:pt-0 shadow-md md:shadow-none">
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

                    <div className="flex items-end gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex-1 md:flex-none md:pl-4 md:border-l border-accent-gray/50">
                            <label className="text-[10px] font-bold text-primary-red uppercase block mb-1">Fastest Lap</label>
                            <div className="w-full md:w-48 h-14">
                                <SelectorCard
                                    option={selectedFLDriver}
                                    isSelected={!!selectedFLDriver}
                                    onClick={() => openDriverModal('fastestLap', 0, 'Select Fastest Lap')}
                                    placeholder="Select FL..."
                                    disabled={false}
                                    color={flColor}
                                    forceColor={!!selectedFLDriver}
                                />
                            </div>
                        </div>

                        <div className="flex items-end gap-3 flex-shrink-0 ml-2">
                            <button
                                type="button"
                                onClick={onToggleLock}
                                className={`font-bold px-4 rounded text-xs border transition-colors h-14 ${
                                    isLocked 
                                    ? 'bg-transparent border-green-600 text-green-500 hover:bg-green-600/10' 
                                    : 'bg-transparent border-primary-red text-primary-red hover:bg-primary-red/10'
                                }`}
                            >
                                {isLocked ? 'Unlock Picks' : 'Lock Picks'}
                            </button>

                            <button
                                type="submit"
                                disabled={saveState !== 'idle'}
                                className={`font-bold px-6 rounded text-xs text-pure-white transition-colors min-w-[120px] h-14 ${buttonClasses[saveState]}`}
                            >
                                {buttonContent[saveState]}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1">
                    {!event.hasSprint ? (
                        <section className="bg-carbon-black/40 rounded-xl p-6 border border-pure-white/5 flex flex-col mb-6">
                            <div className="flex items-center gap-2 mb-6 border-b border-accent-gray/30 pb-3 flex-shrink-0">
                                <CheckeredFlagIcon className="w-5 h-5 text-primary-red" />
                                <h3 className="font-bold text-sm uppercase tracking-wider text-pure-white">Grand Prix Session</h3>
                            </div>
                            {renderGpContent()}
                        </section>
                    ) : (
                        <>
                            <div className="flex flex-col">
                                <AccordionHeader 
                                    title="Grand Prix Session" 
                                    icon={CheckeredFlagIcon} 
                                    isActive={activeSession === 'gp'} 
                                    onClick={() => setActiveSession(activeSession === 'gp' ? null : 'gp')} 
                                />
                                {activeSession === 'gp' && (
                                    <div className="bg-carbon-black/40 border-x border-b border-pure-white/5 p-6 rounded-b-xl mb-6">
                                        {renderGpContent()}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col">
                                <AccordionHeader 
                                    title="Sprint Session" 
                                    icon={SprintIcon} 
                                    isActive={activeSession === 'sprint'} 
                                    onClick={() => setActiveSession(activeSession === 'sprint' ? null : 'sprint')} 
                                />
                                {activeSession === 'sprint' && (
                                    <div className="bg-carbon-black/40 border-x border-b border-pure-white/5 p-6 rounded-b-xl mb-6">
                                        {renderSprintContent()}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </form>

            {modalContent && (
                <div 
                    className="fixed inset-0 bg-carbon-black/80 flex items-end md:items-center justify-center z-[999] md:p-4 pb-safe md:pb-4" 
                    onClick={() => setModalContent(null)}
                >
                    <div 
                        className="bg-carbon-fiber rounded-t-2xl md:rounded-lg w-full md:max-w-3xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto animate-slide-up shadow-2xl ring-1 ring-pure-white/10 border border-pure-white/10" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setModalContent(null)}>
                            <div className="w-12 h-1.5 bg-pure-white/20 rounded-full"></div>
                        </div>
                        {modalContent}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ResultGroupProps {
    positions: number;
    selected: (string | null)[];
    onTrigger: (index: number) => void;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    cols?: number;
}

const ResultGroup: React.FC<ResultGroupProps> = ({ positions, selected, onTrigger, allDrivers, allConstructors, cols = 1 }) => {
    const gridClass = cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';
    
    return (
        <div className={`grid gap-x-8 gap-y-4 content-start ${gridClass}`}>
            {Array.from({ length: positions }).map((_, i) => {
                const driverId = selected[i];
                const driver = allDrivers.find(d => d.id === driverId);
                let color = undefined;
                if (driver) {
                    const constructor = allConstructors.find(c => c.id === driver.constructorId) || CONSTRUCTORS.find(c => c.id === driver.constructorId);
                    color = constructor?.color;
                }

                return (
                    <div key={i} className="flex items-center gap-3">
                        <label className="w-6 text-xs font-black text-highlight-silver text-right">P{i + 1}</label>
                        <div className="flex-1 h-14">
                            <SelectorCard
                                option={driver || null}
                                isSelected={!!driver}
                                onClick={() => onTrigger(i)}
                                placeholder="Select Driver..."
                                disabled={false}
                                color={color}
                                forceColor={!!driver}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ResultsForm;