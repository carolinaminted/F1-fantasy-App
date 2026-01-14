
import React, { useState, useEffect, useMemo } from 'react';
import { Event, EventResult, Driver, Constructor } from '../types.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { SelectorCard } from './PicksForm.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import { UnlockIcon } from './icons/UnlockIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';

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
    p22Driver: null,
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
    const { showToast } = useToast();

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

    // Derive Fastest Lap selection state for rendering
    const selectedFLDriver = allDrivers.find(d => d.id === results.fastestLap) || null;
    let flColor = undefined;
    if (selectedFLDriver) {
        const cId = selectedFLDriver.constructorId;
        flColor = allConstructors.find(c => c.id === cId)?.color || CONSTRUCTORS.find(c => c.id === cId)?.color;
    }

    // Derive P22 selection state for rendering
    const selectedP22Driver = allDrivers.find(d => d.id === results.p22Driver) || null;
    let p22Color = undefined;
    if (selectedP22Driver) {
        const cId = selectedP22Driver.constructorId;
        p22Color = allConstructors.find(c => c.id === cId)?.color || CONSTRUCTORS.find(c => c.id === cId)?.color;
    }

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

    const handleSingleSelect = (category: 'fastestLap' | 'p22Driver', value: string | null) => {
        setResults(prev => ({ ...prev, [category]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: Grand Prix
        if (results.grandPrixFinish.some(d => !d)) {
            showToast("Please fill in all Grand Prix race positions (P1-P10).", 'error');
            return;
        }
        if (results.gpQualifying.some(d => !d)) {
            showToast("Please fill in all GP Qualifying positions (P1-P3).", 'error');
            return;
        }

        // Validation: Fastest Lap
        if (!results.fastestLap) {
            showToast("Please select a driver for Fastest Lap.", 'error');
            return;
        }

        // Validation: P22 Driver (Optional but recommended to warn)
        if (!results.p22Driver) {
             if (!confirm("P22 (Last Place) driver is not selected. Proceed?")) {
                 return;
             }
        }

        // Validation: Sprint (if applicable)
        if (event.hasSprint) {
            if (results.sprintFinish?.some(d => !d)) {
                showToast("Please fill in all Sprint race positions (P1-P8).", 'error');
                return;
            }
            if (results.sprintQualifying?.some(d => !d)) {
                showToast("Please fill in all Sprint Qualifying positions (P1-P3).", 'error');
                return;
            }
        }

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
            if (category === 'fastestLap' || category === 'p22Driver') {
                handleSingleSelect(category as 'fastestLap' | 'p22Driver', driverId);
            } else {
                handleSelect(category, driverId, index);
            }
            setModalContent(null);
        };

        const currentSelection = (category === 'fastestLap' || category === 'p22Driver') 
            ? results[category] 
            : (results[category] as (string | null)[])[index];

        const modalBody = (
            <div className="p-6">
                <div className="text-center mb-6">
                    <h4 className="text-2xl font-bold text-pure-white">{title}</h4>
                </div>
                
                {/* Clear Selection - Moved outside grid to preserve alignment of teammates */}
                <button
                    onClick={() => handleSelection(null)}
                    className="w-full mb-4 p-3 rounded-lg border border-dashed border-accent-gray bg-carbon-black/30 hover:bg-carbon-black/60 hover:border-highlight-silver cursor-pointer flex items-center justify-center text-highlight-silver font-bold uppercase tracking-wider text-xs transition-all group"
                >
                    <span className="group-hover:text-pure-white transition-colors">Clear Selection</span>
                </button>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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

    const renderGpContent = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
                {/* Fastest Lap */}
                <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Fastest Lap</h4>
                    <div className="bg-carbon-black/20 rounded-lg p-3 md:p-4">
                        <div className="flex items-center gap-3">
                            <label className="w-6 text-xs font-black text-highlight-silver text-right">FL</label>
                            <div className="flex-1 h-14">
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
                    </div>
                </div>

                {/* P22 Driver */}
                <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1 flex items-center gap-2">
                        P22 (Last Place)
                    </h4>
                    <div className="bg-carbon-black/20 rounded-lg p-3 md:p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-6 flex justify-end">
                                <TrashIcon className="w-4 h-4 text-highlight-silver" />
                            </div>
                            <div className="flex-1 h-14">
                                <SelectorCard
                                    option={selectedP22Driver}
                                    isSelected={!!selectedP22Driver}
                                    onClick={() => openDriverModal('p22Driver', 0, 'Select P22 (Last Place)')}
                                    placeholder="Select P22..."
                                    disabled={false}
                                    color={p22Color}
                                    forceColor={!!selectedP22Driver}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Qualifying</h4>
                    <div className="bg-carbon-black/20 rounded-lg p-3 md:p-4">
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
            </div>
            <div className="lg:col-span-9 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Race Results</h4>
                <div className="bg-carbon-black/20 rounded-lg p-3 md:p-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-3 flex flex-col">
                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3 px-1">Sprint Quali</h4>
                <div className="bg-carbon-black/20 rounded-lg p-3 md:p-4">
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
                <div className="bg-carbon-black/20 rounded-lg p-3 md:p-4">
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

    return (
        <div className="text-pure-white flex flex-col min-h-0">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
                {/* Updated Header Layout: Buttons to the right, transparent background to show carbon fiber */}
                <div className="flex flex-row justify-between items-center mb-4 pb-4 border-b border-white/10 flex-shrink-0 pt-0">
                    <div className="flex flex-col min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-bold truncate">{event.name}</h2>
                            {isLocked && (
                                <span className="bg-primary-red/20 text-primary-red px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-primary-red/20">
                                    Locked
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-highlight-silver truncate">{event.country} • Round {event.round}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onToggleLock}
                            className={`h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl border transition-all ${
                                isLocked 
                                ? 'bg-red-900/20 border-primary-red text-primary-red hover:bg-primary-red hover:text-white' 
                                : 'bg-green-900/20 border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                            }`}
                            title={isLocked ? 'Unlock Picks' : 'Lock Picks'}
                        >
                            {isLocked ? <LockIcon className="w-5 h-5" /> : <UnlockIcon className="w-5 h-5" />}
                        </button>

                        <button
                            type="submit"
                            disabled={saveState !== 'idle'}
                            className={`h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl border transition-all ${
                                saveState === 'success'
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-carbon-black border-accent-gray text-highlight-silver hover:text-white hover:border-pure-white'
                            }`}
                            title="Save Results"
                        >
                            {saveState === 'saving' ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : saveState === 'success' ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <SaveIcon className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex-1">
                    {!event.hasSprint ? (
                        <section className="bg-carbon-black/40 rounded-xl p-4 md:p-6 border border-pure-white/5 flex flex-col mb-6">
                            <div className="flex items-center gap-2 mb-4 md:mb-6 border-b border-accent-gray/30 pb-3 flex-shrink-0">
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
                                    <div className="bg-carbon-black/40 border-x border-b border-pure-white/5 p-4 md:p-6 rounded-b-xl mb-6">
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
                                    <div className="bg-carbon-black/40 border-x border-b border-pure-white/5 p-4 md:p-6 rounded-b-xl mb-6">
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
