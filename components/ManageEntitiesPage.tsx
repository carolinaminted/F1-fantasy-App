import React, { useState } from 'react';
import { Driver, Constructor, EntityClass } from '../types.ts';
import { saveLeagueEntities } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { GarageIcon } from './icons/GarageIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

interface ManageEntitiesPageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'simulation' | 'schedule' | 'invitations') => void;
    currentDrivers: Driver[];
    currentConstructors: Constructor[];
    onUpdateEntities: (drivers: Driver[], constructors: Constructor[]) => void;
}

const ManageEntitiesPage: React.FC<ManageEntitiesPageProps> = ({ setAdminSubPage, currentDrivers, currentConstructors, onUpdateEntities }) => {
    const [activeTab, setActiveTab] = useState<'drivers' | 'teams'>('drivers');
    const [drivers, setDrivers] = useState<Driver[]>(currentDrivers);
    const [constructors, setConstructors] = useState<Constructor[]>(currentConstructors);
    const [isSaving, setIsSaving] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    
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

    const openModal = (entity?: Driver | Constructor) => {
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

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    const HeaderControls = (
        <div className="flex gap-3 items-center justify-center md:justify-end w-full md:w-auto mt-4 md:mt-0">
             <div className="flex bg-accent-gray rounded-lg p-1 shadow-lg">
                <button
                    onClick={() => setActiveTab('drivers')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'drivers' ? 'bg-pure-white text-carbon-black shadow-sm' : 'text-highlight-silver hover:text-pure-white'}`}
                >
                    <DriverIcon className="w-4 h-4" /> Drivers
                </button>
                <button
                    onClick={() => setActiveTab('teams')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'teams' ? 'bg-pure-white text-carbon-black shadow-sm' : 'text-highlight-silver hover:text-pure-white'}`}
                >
                    <TeamIcon className="w-4 h-4" /> Teams
                </button>
            </div>
            
            <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary-red hover:bg-red-600 p-2 rounded-lg text-pure-white shadow-lg disabled:opacity-50 flex items-center justify-center transition-all transform hover:scale-105 border border-transparent"
                aria-label="Save"
                title="Save Changes"
            >
                {isSaving ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <SaveIcon className="w-5 h-5" />
                )}
            </button>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto text-pure-white flex flex-col h-full">
            <PageHeader 
                title="MANAGE ROSTER" 
                icon={GarageIcon} 
                leftAction={DashboardAction}
                rightAction={HeaderControls}
            />
            
            {/* Outer container: flex-1 allows desktop layout to fill screen, md:overflow-hidden keeps scroll localized to table on desktop */}
            <div className="flex-1 md:overflow-hidden px-4 md:px-0 pb-8 flex flex-col">
                {/* Content Card: md:flex-1 and md:overflow-hidden ensures desktop scrolling, while allowing natural expansion on mobile */}
                <div className="bg-carbon-fiber rounded-lg border border-pure-white/10 shadow-lg md:overflow-hidden flex flex-col md:flex-1">
                    <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-carbon-black/50 border-b border-pure-white/10 flex-shrink-0">
                        <h2 className="text-xl font-bold">{activeTab === 'drivers' ? 'Driver Roster' : 'Constructor List'}</h2>
                        
                        <div className="flex items-center gap-2 bg-carbon-black/80 rounded-lg p-1">
                            {(['all', 'active', 'inactive'] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors ${
                                        filterStatus === status 
                                        ? 'bg-primary-red text-pure-white' 
                                        : 'text-highlight-silver hover:text-pure-white'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-500 text-pure-white px-4 py-1.5 rounded text-sm font-bold w-full md:w-auto">
                            + Add New
                        </button>
                    </div>
                    {/* Table Container: md:overflow-y-auto ensures the table is scrollable only on desktop/large screens */}
                    <div className="md:overflow-y-auto md:flex-1 custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-carbon-black/30 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Name</th>
                                    <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Class</th>
                                    {activeTab === 'drivers' && <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Team</th>}
                                    {activeTab === 'teams' && <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Color</th>}
                                    <th className="p-4 text-xs font-bold uppercase text-highlight-silver text-center hidden md:table-cell">Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getFilteredEntities().map((entity) => (
                                    <tr 
                                        key={entity.id} 
                                        onClick={() => openModal(entity)}
                                        className="border-t border-pure-white/5 hover:bg-pure-white/5 cursor-pointer"
                                    >
                                        <td className="p-4 font-semibold">{entity.name} <span className="text-xs text-highlight-silver block">{entity.id}</span></td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${entity.class === EntityClass.A ? 'bg-[#FCD12A] text-black' : 'bg-blue-900 text-blue-100'}`}>
                                                Class {entity.class}
                                            </span>
                                        </td>
                                        {activeTab === 'drivers' && (
                                            <td className="p-4">
                                                {(() => {
                                                    const teamId = (entity as Driver).constructorId;
                                                    const team = constructors.find(c => c.id === teamId);
                                                    const color = team?.color || '#888888';
                                                    return (
                                                        <span 
                                                            className="inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border border-white/10"
                                                            style={{ 
                                                                backgroundColor: `${color}33`, 
                                                                color: color,
                                                                borderColor: `${color}40`
                                                            }}
                                                        >
                                                            {team?.name || teamId}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                        )}
                                        {activeTab === 'teams' && (
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        className="w-4 h-4 rounded-full border border-white/20" 
                                                        style={{ backgroundColor: (entity as Constructor).color }}
                                                    />
                                                    <span className="text-xs text-highlight-silver">{(entity as Constructor).color}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="p-4 text-center hidden md:table-cell">
                                             <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleActive(entity.id, activeTab);
                                                }}
                                                className={`px-3 py-1 rounded-full text-xs font-bold w-20 ${entity.isActive ? 'bg-green-600/80 text-pure-white' : 'bg-red-900/50 text-red-200'}`}
                                             >
                                                {entity.isActive ? 'Active' : 'Inactive'}
                                             </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-carbon-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-carbon-fiber rounded-lg max-w-md w-full p-6 ring-1 ring-pure-white/20 max-h-[90vh] overflow-y-auto shadow-2xl border border-pure-white/10">
                        <h3 className="text-2xl font-bold mb-4">{editEntityId ? 'Edit Entity' : 'Add New Entity'}</h3>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">ID (Unique)</label>
                                <input 
                                    type="text" 
                                    value={formId} 
                                    onChange={e => setFormId(e.target.value)} 
                                    disabled={!!editEntityId}
                                    className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white disabled:opacity-50"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Display Name</label>
                                <input 
                                    type="text" 
                                    value={formName} 
                                    onChange={e => setFormName(e.target.value)} 
                                    className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Class</label>
                                <select 
                                    value={formClass} 
                                    onChange={e => setFormClass(e.target.value as EntityClass)} 
                                    className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                >
                                    <option value={EntityClass.A}>Class A</option>
                                    <option value={EntityClass.B}>Class B</option>
                                </select>
                            </div>
                            {activeTab === 'drivers' && (
                                <div>
                                    <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Team</label>
                                    <select 
                                        value={formTeamId} 
                                        onChange={e => setFormTeamId(e.target.value)} 
                                        className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                    >
                                        {constructors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {activeTab === 'teams' && (
                                <div>
                                    <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Team Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" 
                                            value={formColor} 
                                            onChange={e => setFormColor(e.target.value)}
                                            className="w-10 h-10 rounded border-none cursor-pointer"
                                        />
                                        <input 
                                            type="text"
                                            value={formColor}
                                            onChange={e => setFormColor(e.target.value)}
                                            className="flex-1 bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                            placeholder="#RRGGBB"
                                        />
                                    </div>
                                </div>
                            )}
                             <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="isActiveCheck"
                                    checked={formIsActive} 
                                    onChange={e => setFormIsActive(e.target.checked)} 
                                    className="w-4 h-4"
                                />
                                <label htmlFor="isActiveCheck" className="text-sm font-bold text-pure-white">Active for Selection</label>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-highlight-silver hover:text-pure-white">Cancel</button>
                                <button type="submit" className="bg-primary-red px-6 py-2 rounded text-pure-white font-bold hover:opacity-90">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageEntitiesPage;