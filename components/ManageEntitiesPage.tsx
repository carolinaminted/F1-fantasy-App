import React, { useState } from 'react';
import { Driver, Constructor, EntityClass } from '../types.ts';
import { saveLeagueEntities } from '../services/firestoreService.ts';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { GarageIcon } from './icons/GarageIcon.tsx';
import {
    DataTable, SegmentedControl, Modal, Chip, NUMERIC,
    type Column, type Segment,
} from './ui/index.ts';
import { AdminToolShell, useUnsavedChanges, UnsavedChangesBanner } from './admin/index.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import type { AdminDestination } from '../routes.ts';

interface ManageEntitiesPageProps {
    setAdminSubPage: (page: AdminDestination) => void;
    currentDrivers: Driver[];
    currentConstructors: Constructor[];
    onUpdateEntities: (drivers: Driver[], constructors: Constructor[]) => void;
}

type EntityTab = 'drivers' | 'teams';
type StatusFilter = 'all' | 'active' | 'inactive';

const TABS: Segment<EntityTab>[] = [
    { value: 'drivers', label: 'Drivers', icon: DriverIcon },
    { value: 'teams', label: 'Teams', icon: TeamIcon },
];

const STATUS_FILTERS: Segment<StatusFilter>[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Racing' },
    { value: 'inactive', label: 'Retired' },
];

const ManageEntitiesPage: React.FC<ManageEntitiesPageProps> = ({ setAdminSubPage, currentDrivers, currentConstructors, onUpdateEntities }) => {
    const [activeTab, setActiveTab] = useState<EntityTab>('drivers');
    const [drivers, setDrivers] = useState<Driver[]>(currentDrivers);
    const [constructors, setConstructors] = useState<Constructor[]>(currentConstructors);
    const [isSaving, setIsSaving] = useState(false);
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editEntityId, setEditEntityId] = useState<string | null>(null); // Null means adding new
    
    // Form State
    const [formName, setFormName] = useState('');
    const [formId, setFormId] = useState('');
    const [formClass, setFormClass] = useState<EntityClass>(EntityClass.A);
    const [formTeamId, setFormTeamId] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);
    const [formColor, setFormColor] = useState('#FFFFFF');

    const { showToast } = useToast();

    /*
      Nothing here reaches Firestore until Save. Retiring five drivers and walking away
      used to discard all of it silently, behind an unlabelled icon button.
    */
    const isDirty =
        JSON.stringify(drivers) !== JSON.stringify(currentDrivers) ||
        JSON.stringify(constructors) !== JSON.stringify(currentConstructors);
    const { confirmLeave } = useUnsavedChanges(isDirty);

    const discardChanges = () => {
        setDrivers(currentDrivers);
        setConstructors(currentConstructors);
    };

    const openModal = (entity?: Driver | Constructor) => {
        if (isSaving) return;
        if (entity) {
            setEditEntityId(entity.id);
            setFormName(entity.name);
            setFormId(entity.id);
            setFormClass(entity.class);
            setFormIsActive(entity.isActive);
            if (activeTab === 'drivers') {
                setFormTeamId((entity as Driver).constructorId);
            } else {
                setFormColor((entity as Constructor).color || '#FFFFFF');
            }
        } else {
            setEditEntityId(null);
            setFormName('');
            setFormId('');
            setFormClass(EntityClass.A);
            setFormIsActive(true);
            setFormTeamId(constructors[0]?.id || '');
            setFormColor('#FFFFFF');
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await saveLeagueEntities(drivers, constructors);
            onUpdateEntities(drivers, constructors);
            showToast("Changes saved successfully!", 'success');
        } catch (e) {
            console.error(e);
            showToast("Failed to save changes.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (activeTab === 'drivers') {
            const newDriver: Driver = {
                id: editEntityId || formId.toLowerCase().replace(/\s+/g, '_'),
                name: formName,
                class: formClass,
                constructorId: formTeamId,
                isActive: formIsActive
            };
            
            setDrivers(prev => {
                if (editEntityId) return prev.map(d => d.id === editEntityId ? newDriver : d);
                return [...prev, newDriver];
            });
        } else {
             const newConstructor: Constructor = {
                id: editEntityId || formId.toLowerCase().replace(/\s+/g, '_'),
                name: formName,
                class: formClass,
                isActive: formIsActive,
                color: formColor
            };
             setConstructors(prev => {
                if (editEntityId) return prev.map(c => c.id === editEntityId ? newConstructor : c);
                return [...prev, newConstructor];
            });
        }
        setShowModal(false);
    };

    const toggleActive = (id: string, type: 'drivers' | 'teams') => {
        if (isSaving) return;
        if (type === 'drivers') {
            setDrivers(prev => prev.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d));
        } else {
            setConstructors(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
        }
    };

    const getFilteredEntities = () => {
        const source = activeTab === 'drivers' ? drivers : constructors;
        return source.filter(entity => {
            if (filterStatus === 'active') return entity.isActive;
            if (filterStatus === 'inactive') return !entity.isActive;
            return true;
        });
    };

    const columns: Column<Driver | Constructor>[] = [
        {
            key: 'name',
            header: 'Name',
            render: entity => (
                <div className="min-w-0">
                    <span className="block truncate font-bold text-pure-white">{entity.name}</span>
                    <span className={`block truncate text-[10px] lowercase text-highlight-silver opacity-60 ${NUMERIC}`}>
                        {entity.id}
                    </span>
                </div>
            ),
        },
        {
            key: 'class',
            header: 'Class',
            align: 'center',
            render: entity => (
                <Chip
                    label={`Class ${entity.class}`}
                    tone={entity.class === EntityClass.A ? 'danger' : 'info'}
                    size="xs"
                />
            ),
        },
        {
            key: 'detail',
            header: activeTab === 'drivers' ? 'Team' : 'Colour',
            hideOnMobile: true,
            render: entity => {
                if (activeTab === 'drivers') {
                    const driver = entity as Driver;
                    const teamObj = constructors.find(c => c.id === driver.constructorId)
                        ?? CONSTRUCTORS.find(c => c.id === driver.constructorId);
                    return <Chip label={teamObj?.name || driver.constructorId} color={teamObj?.color} size="xs" />;
                }
                const constructor = entity as Constructor;
                return (
                    <div className="flex items-center gap-2">
                        <span
                            className="h-4 w-4 rounded-full border border-pure-white/20"
                            style={{ backgroundColor: constructor.color }}
                        />
                        <span className={`text-[11px] uppercase text-highlight-silver ${NUMERIC}`}>
                            {constructor.color}
                        </span>
                    </div>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            render: entity => (
                <button
                    onClick={e => { e.stopPropagation(); toggleActive(entity.id, activeTab); }}
                    className={`w-24 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                        entity.isActive
                            ? 'border-green-500/30 bg-green-500/15 text-green-400'
                            : 'border-pure-white/15 bg-pure-white/5 text-highlight-silver'
                    }`}
                    title={entity.isActive ? 'Tap to retire' : 'Tap to bring back'}
                >
                    {entity.isActive ? 'Racing' : 'Retired'}
                </button>
            ),
        },
    ];

    return (
        <div className="max-w-6xl mx-auto text-pure-white flex flex-col h-full">
            <AdminToolShell
                title="DRIVERS & TEAMS"
                icon={GarageIcon}
                subtitle="Who is on the grid, and which class they race in"
                setAdminSubPage={setAdminSubPage}
                onBeforeLeave={confirmLeave}
                actions={
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !isDirty}
                        className="flex items-center gap-2 rounded-lg bg-primary-red px-4 py-2 text-[11px] font-black uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600 disabled:opacity-40"
                    >
                        <SaveIcon className="w-4 h-4" />
                        {isSaving ? 'Saving\u2026' : 'Save changes'}
                    </button>
                }
            />

            <UnsavedChangesBanner
                isDirty={isDirty}
                onSave={handleSave}
                onDiscard={discardChanges}
                saving={isSaving}
                summary="Your changes to the grid are only on this screen until you save them."
            />

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-8 pt-4 md:overflow-hidden md:px-1">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <SegmentedControl
                        segments={TABS}
                        value={activeTab}
                        onChange={v => !isSaving && setActiveTab(v)}
                    />
                    <div className="flex items-center gap-3">
                        <SegmentedControl
                            segments={STATUS_FILTERS}
                            value={filterStatus}
                            onChange={v => !isSaving && setFilterStatus(v)}
                            size="sm"
                        />
                        <button
                            onClick={() => !isSaving && openModal()}
                            disabled={isSaving}
                            className="whitespace-nowrap rounded-lg border border-pure-white/15 bg-pure-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10 disabled:opacity-50"
                        >
                            {activeTab === 'drivers' ? 'Add driver' : 'Add team'}
                        </button>
                    </div>
                </div>

                <div className={`flex min-h-0 flex-1 flex-col ${isSaving ? 'pointer-events-none opacity-60' : ''}`}>
                    <DataTable
                        columns={columns}
                        rows={getFilteredEntities()}
                        rowKey={entity => entity.id}
                        onRowClick={entity => openModal(entity)}
                        scrollInside
                        emptyTitle={activeTab === 'drivers' ? 'No drivers here' : 'No teams here'}
                        emptyDescription="Try a different filter, or add one."
                    />
                </div>
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={
                    editEntityId
                        ? `Edit ${activeTab === 'drivers' ? 'driver' : 'team'}`
                        : `Add a ${activeTab === 'drivers' ? 'driver' : 'team'}`
                }
                icon={activeTab === 'drivers' ? DriverIcon : TeamIcon}
                size="sm"
            >
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                            Name
                        </label>
                        <input
                            type="text" required
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            placeholder={activeTab === 'drivers' ? 'e.g. Lando Norris' : 'e.g. McLaren'}
                            className="w-full rounded-lg border border-pure-white/15 bg-carbon-black p-2 text-pure-white focus:border-primary-red focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                            Short code
                        </label>
                        <input
                            type="text" required
                            value={formId}
                            onChange={e => setFormId(e.target.value)}
                            disabled={!!editEntityId}
                            placeholder="e.g. lando_norris"
                            className={`w-full rounded-lg border border-pure-white/15 bg-carbon-black p-2 text-pure-white focus:border-primary-red focus:outline-none disabled:opacity-50 ${NUMERIC}`}
                        />
                        <p className="mt-1 text-[11px] text-highlight-silver">
                            {editEntityId
                                ? "Used internally to link picks and results. It can't be changed."
                                : "Used internally to link picks and results. Lowercase, no spaces \u2014 and it can't be changed later."}
                        </p>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                            Class
                        </label>
                        <select
                            value={formClass}
                            onChange={e => setFormClass(e.target.value as EntityClass)}
                            className="w-full rounded-lg border border-pure-white/15 bg-carbon-black p-2 text-pure-white focus:border-primary-red focus:outline-none"
                        >
                            <option value={EntityClass.A}>Class A</option>
                            <option value={EntityClass.B}>Class B</option>
                        </select>
                    </div>

                    {activeTab === 'drivers' && (
                        <div>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                                Team
                            </label>
                            <select
                                value={formTeamId}
                                onChange={e => setFormTeamId(e.target.value)}
                                className="w-full rounded-lg border border-pure-white/15 bg-carbon-black p-2 text-pure-white focus:border-primary-red focus:outline-none"
                            >
                                {constructors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    {activeTab === 'teams' && (
                        <div>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                                Team colour
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={formColor}
                                    onChange={e => setFormColor(e.target.value)}
                                    className="h-10 w-12 cursor-pointer rounded border-none bg-transparent"
                                />
                                <input
                                    type="text"
                                    value={formColor}
                                    onChange={e => setFormColor(e.target.value)}
                                    placeholder="#RRGGBB"
                                    className={`flex-1 rounded-lg border border-pure-white/15 bg-carbon-black p-2 text-pure-white focus:border-primary-red focus:outline-none ${NUMERIC}`}
                                />
                            </div>
                        </div>
                    )}

                    <label className="flex cursor-pointer items-start gap-2.5">
                        <input
                            type="checkbox"
                            checked={formIsActive}
                            onChange={e => setFormIsActive(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-primary-red"
                        />
                        <span>
                            <span className="block text-sm font-bold text-pure-white">Currently racing</span>
                            <span className="block text-[11px] text-highlight-silver">
                                Members can only pick someone who is racing. Untick to retire them
                                without losing their past results.
                            </span>
                        </span>
                    </label>

                    <div className="mt-6 flex items-center justify-end gap-3 border-t border-pure-white/10 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="rounded-lg border border-pure-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:text-pure-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-lg bg-primary-red px-4 py-2 text-xs font-black uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600"
                        >
                            {editEntityId ? 'Apply' : 'Add'}
                        </button>
                    </div>

                    {/* The old button said "Add to List", which was accurate but nobody would
                        infer it meant "not saved yet". Say it outright instead. */}
                    <p className="text-center text-[11px] text-highlight-silver">
                        You still need to press <strong className="text-pure-white">Save changes</strong> at
                        the top to keep this.
                    </p>
                </form>
            </Modal>
        </div>
    );
};

export default ManageEntitiesPage;