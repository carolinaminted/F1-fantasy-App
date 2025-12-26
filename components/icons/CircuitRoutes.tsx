
import React from 'react';

// High-fidelity SVG paths normalized for a 50x50 viewBox
const CIRCUIT_PATHS: { [key: string]: string } = {
    // Bahrain (Sakhir)
    'bhr': 'M35,42 H15 L12,35 L18,32 L22,35 L25,32 L25,20 L15,20 L12,15 L18,10 H38 L42,18 L35,18 L35,28 L42,28 L45,35 L38,42 Z',
    
    // Saudi Arabia (Jeddah)
    'sau': 'M38,45 C30,48 15,45 12,35 C10,30 10,15 12,10 C15,5 35,5 40,10 C45,15 45,40 38,45',
    
    // Australia (Albert Park) - Updated for higher fidelity to the actual lake-side route
    'aus': 'M15,42 L12,38 L12,28 L15,24 L18,22 L15,18 L15,10 L20,8 L35,8 L40,12 L42,20 L40,28 L42,32 L38,38 L32,42 L25,40 L15,42 Z',
    
    // China (Shanghai) - Updated with user reference
    'chn': 'M25,40 L38,40 C42,40 42,32 38,30 C35,28 32,32 34,35 L25,32 L15,35 L12,28 L20,20 L12,15 L15,8 L40,10 L42,15 L38,18 Z',
    
    // Japan (Suzuka)
    'jpn': 'M35,40 L15,40 L12,32 L20,28 L32,18 L38,12 L30,8 L15,8 L10,15 L25,25 L15,32 L18,40',
    
    // Miami (Hard Rock) - Updated with user reference
    'mia': 'M28,22 L38,24 L35,30 L25,28 C15,25 5,35 15,40 Q25,42 35,38 L38,32 L44,28 L40,24 L46,18 L44,12 L12,15 Q8,18 15,20 L28,22 Z',
    
    // Canada (Montreal)
    'can': 'M20,42 L12,38 L14,12 L38,10 L40,15 L38,35 L32,42 L25,38 L22,42 Z',
    
    // Monaco
    'mco': 'M22,40 L18,35 L18,28 L25,22 L20,15 L25,10 L35,12 L40,25 L35,35 L25,35 L22,40',
    
    // Spain (Barcelona) - No chicane layout
    'esp': 'M20,42 L12,35 L12,15 L30,10 L42,15 L42,30 L35,35 L30,32 L25,35 Z',
    
    // Austria (Red Bull Ring)
    'aut': 'M18,38 L18,25 L32,10 L42,12 L45,20 L40,38 L25,32 Z',
    
    // Great Britain (Silverstone)
    'gbr': 'M25,45 L15,38 L18,25 L12,18 L22,10 L32,12 L42,18 L38,28 L42,35 L30,45 Z',
    
    // Belgium (Spa)
    'bel': 'M20,45 L12,35 L15,15 L35,5 L45,15 L38,35 L28,32 L25,38 Z',
    
    // Hungary (Hungaroring)
    'hun': 'M18,38 L12,28 L18,12 L38,12 L42,20 L38,32 L28,28 L22,38 Z',
    
    // Netherlands (Zandvoort)
    'nld': 'M22,40 L12,30 L15,12 L35,12 L40,22 L32,35 L25,30 Z',
    
    // Italy (Monza)
    'ita': 'M18,40 L15,15 L30,10 L40,15 L38,35 L28,35 Z',
    
    // Madrid (IFEMA) - Speculative layout based on announcement
    'mad': 'M15,35 L15,20 L35,15 L40,25 L35,35 L25,40 L20,35 Z',
    
    // Azerbaijan (Baku)
    'aze': 'M15,40 L15,15 L35,15 L35,22 L40,22 L40,40 L25,40 L25,35 Z',
    
    // Singapore (Marina Bay) - Updated straight section
    'sgp': 'M18,38 L15,18 L35,15 L38,38 L25,40 L25,30 L20,30 L20,38 Z',
    
    // USA (COTA)
    'usa': 'M20,42 L10,30 L15,12 L35,15 L40,28 L32,35 L25,30 L22,35 Z',
    
    // Mexico (Mexico City)
    'mex': 'M18,35 L12,25 L18,15 L35,15 L40,25 L35,35 L25,30 Z',
    
    // Brazil (Interlagos)
    'bra': 'M28,40 L18,30 L18,20 L30,15 L35,25 L30,35 L25,30 Z',
    
    // Las Vegas
    'las': 'M18,35 L18,15 L32,15 L32,30 L28,35 L22,32 Z',
    
    // Qatar (Lusail)
    'qat': 'M18,35 L15,25 L25,12 L38,22 L35,35 Z',
    
    // Abu Dhabi (Yas Marina)
    'abu': 'M18,35 L18,15 L25,10 L38,15 L35,35 L28,30 Z',
};

// Generic Track Design (Used as default)
// A stylized figure-8 / loop shape to represent a racing circuit
const DEFAULT_PATH = 'M15,35 C5,35 5,15 15,15 L35,15 C45,15 45,35 35,35 L15,35 Z M18,20 L32,20 C38,20 38,30 32,30 L18,30 C12,30 12,20 18,20 Z';

interface CircuitRouteProps extends React.SVGProps<SVGSVGElement> {
    eventId: string;
}

export const CircuitRoute: React.FC<CircuitRouteProps> = ({ eventId, ...props }) => {
    const circuitCode = eventId.split('_')[0];
    const pathData = CIRCUIT_PATHS[circuitCode] || DEFAULT_PATH;

    return (
        <svg
            viewBox="0 0 50 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d={pathData} />
        </svg>
    );
};
