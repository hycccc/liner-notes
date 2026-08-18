'use client';

import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

// Map topology data
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Colors grouped by continent
const continentColors = {
  asia: {
    primary: '#EF4444',
    secondary: '#F87171',
    glow: 'rgba(239, 68, 68, 0.6)',
    name: 'Asia',
  },
  europe: {
    primary: '#F59E0B',
    secondary: '#FBBF24',
    glow: 'rgba(245, 158, 11, 0.6)',
    name: 'Europe',
  },
  americas: {
    primary: '#A855F7',
    secondary: '#C084FC',
    glow: 'rgba(168, 85, 247, 0.6)',
    name: 'Americas',
  },
  oceania: {
    primary: '#22C55E',
    secondary: '#4ADE80',
    glow: 'rgba(34, 197, 94, 0.6)',
    name: 'Oceania',
  },
};

interface Location {
  name: string;
  lat: number;
  lng: number;
  continent: keyof typeof continentColors;
  isHome?: boolean;
  country?: string;
}

const locations: Location[] = [
  // Europe — the night-train tour
  { name: 'Lisbon', lat: 38.7223, lng: -9.1393, continent: 'europe', isHome: true, country: 'Portugal' },
  { name: 'Porto', lat: 41.1579, lng: -8.6291, continent: 'europe', country: 'Portugal' },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038, continent: 'europe', country: 'Spain' },
  { name: 'Barcelona', lat: 41.3874, lng: 2.1686, continent: 'europe', country: 'Spain' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, continent: 'europe', country: 'France' },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, continent: 'europe', country: 'Netherlands' },
  { name: 'Berlin', lat: 52.52, lng: 13.405, continent: 'europe', country: 'Germany' },
  { name: 'Prague', lat: 50.0755, lng: 14.4378, continent: 'europe', country: 'Czechia' },
  { name: 'Vienna', lat: 48.2082, lng: 16.3738, continent: 'europe', country: 'Austria' },
  // Farther afield
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, continent: 'asia', country: 'Japan' },
  { name: 'Seoul', lat: 37.5665, lng: 126.978, continent: 'asia', country: 'South Korea' },
  { name: 'New York', lat: 40.7128, lng: -74.006, continent: 'americas', country: 'United States' },
  { name: 'Auckland', lat: -36.8485, lng: 174.7633, continent: 'oceania', country: 'New Zealand' },
];

// Custom marker component
function CustomMarker({ 
  location, 
  isSelected, 
  onClick, 
  onMouseEnter, 
  onMouseLeave 
}: {
  location: Location;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const color = continentColors[location.continent];
  const isHome = location.isHome;
  const baseRadius = isHome ? 10 : 7;
  const selectedRadius = isHome ? 14 : 10;

  return (
    <g 
      onClick={onClick} 
      onMouseEnter={onMouseEnter} 
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
    >
      {/* Glow ring - pulse animation only when selected */}
      {isSelected && (
        <>
          <circle
            r={isHome ? 20 : 16}
            fill="none"
            stroke={color.primary}
            strokeWidth={1.5}
            opacity={0.3}
            style={{ animation: 'pulse 2.5s infinite' }}
          />
          <circle
            r={isHome ? 26 : 20}
            fill="none"
            stroke={color.primary}
            strokeWidth={1}
            opacity={0.15}
            style={{ animation: 'pulse 2.5s infinite', animationDelay: '0.5s' }}
          />
        </>
      )}
      
      {/* Main circle */}
      <circle
        r={isSelected ? selectedRadius : baseRadius}
        fill={isHome ? '#F59E0B' : color.primary}
        stroke="white"
        strokeWidth={3.5}
        style={{
          filter: `drop-shadow(0 0 ${isSelected ? 18 : 10}px ${color.glow})`,
          transition: 'r 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    </g>
  );
}

export default function TravelMap() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<Location | null>(null);
  const { theme, mounted } = useTheme();

  if (!mounted) {
    return null;
  }

  const isDark = theme === 'dark';

  // Group locations by continent
  const locationsByContinent = locations.reduce((acc, loc) => {
    if (!acc[loc.continent]) {
      acc[loc.continent] = [];
    }
    acc[loc.continent].push(loc);
    return acc;
  }, {} as Record<keyof typeof continentColors, Location[]>);

  return (
    <div className="space-y-8">
      {/* Animation styles */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 0.2;
            transform: scale(1.4);
          }
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
        }
      `}</style>

      {/* Stat cards - gradient glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`backdrop-blur-2xl border rounded-3xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 ${
          isDark 
            ? 'bg-gradient-to-br from-zinc-900/70 to-zinc-800/50 border-zinc-700' 
            : 'bg-gradient-to-br from-white/70 to-white/50 border-white/30'
        }`}>
          <div className={`text-4xl font-black ${
            isDark 
              ? 'bg-gradient-to-br from-zinc-200 to-zinc-400 bg-clip-text text-transparent' 
              : 'bg-gradient-to-br from-gray-800 to-gray-600 bg-clip-text text-transparent'
          }`}>
            {locations.length}
          </div>
          <div className={`text-sm mt-2 font-semibold tracking-wide ${
            isDark ? 'text-zinc-400' : 'text-gray-600'
          }`}>Total places</div>
        </div>
        {Object.entries(continentColors).map(([key, color]) => {
          const count = locationsByContinent[key as keyof typeof continentColors]?.length || 0;
          return (
            <div
              key={key}
              className={`backdrop-blur-2xl border rounded-3xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 ${
                isDark 
                  ? 'bg-gradient-to-br from-zinc-900/70 to-zinc-800/50 border-zinc-700' 
                  : 'bg-gradient-to-br from-white/70 to-white/50 border-white/30'
              }`}
            >
              <div className="text-4xl font-black" style={{ 
                color: color.primary,
                textShadow: `0 0 20px ${color.glow}`,
              }}>
                {count}
              </div>
              <div className={`text-sm mt-2 font-semibold tracking-wide ${
                isDark ? 'text-zinc-400' : 'text-gray-600'
              }`}>{color.name}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vector map */}
        <div className="lg:col-span-2">
          <div className={`backdrop-blur-2xl border rounded-3xl shadow-2xl overflow-hidden ${
            isDark 
              ? 'bg-gradient-to-br from-zinc-900/70 to-zinc-800/50 border-zinc-700' 
              : 'bg-gradient-to-br from-white/70 to-white/50 border-white/30'
          }`}>
            <div style={{ 
              height: '580px', 
              width: '100%', 
              background: isDark 
                ? 'linear-gradient(180deg, #18181b 0%, #27272a 50%, #3f3f46 100%)'
                : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
            }}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                  scale: 145,
                  center: [0, 28],
                }}
                style={{ width: '100%', height: '100%' }}
              >
                <ZoomableGroup center={selectedLocation ? [selectedLocation.lng, selectedLocation.lat] : [0, 28]} zoom={selectedLocation ? 4.5 : 1}>
                  {/* Gradient defs */}
                  <defs>
                    <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={isDark ? '#27272a' : '#F8FAFC'} />
                      <stop offset="100%" stopColor={isDark ? '#3f3f46' : '#F1F5F9'} />
                    </linearGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Land */}
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="url(#landGradient)"
                          stroke={isDark ? '#52525b' : '#E2E8F0'}
                          strokeWidth={1.2}
                          style={{
                            default: { outline: 'none', transition: 'fill 0.3s ease' },
                            hover: { outline: 'none', fill: isDark ? '#52525b' : '#E2E8F0' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      ))
                    }
                  </Geographies>

                  {/* Markers */}
                  {locations.map((loc, idx) => (
                    <Marker key={idx} coordinates={[loc.lng, loc.lat]}>
                      <CustomMarker
                        location={loc}
                        isSelected={selectedLocation?.name === loc.name}
                        onClick={() => setSelectedLocation(selectedLocation?.name === loc.name ? null : loc)}
                        onMouseEnter={() => setHoveredLocation(loc)}
                        onMouseLeave={() => setHoveredLocation(null)}
                      />
                    </Marker>
                  ))}
                </ZoomableGroup>
              </ComposableMap>

              {/* Hover tooltip */}
              {hoveredLocation && !selectedLocation && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className={`backdrop-blur-2xl border rounded-3xl px-7 py-4 shadow-2xl ${
                    isDark 
                      ? 'bg-gradient-to-br from-zinc-900/95 to-zinc-800/85 border-zinc-700' 
                      : 'bg-gradient-to-br from-white/95 to-white/85 border-white/40'
                  }`}>
                    <div className={`font-black text-xl ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>{hoveredLocation.name}</div>
                    {hoveredLocation.country && (
                      <div className={`text-sm mt-1 font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{hoveredLocation.country}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected location details */}
          {selectedLocation && (
            <div className="mt-6">
              <div 
                className={`backdrop-blur-2xl border rounded-3xl p-8 shadow-2xl ${
                  isDark 
                    ? 'bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 border-zinc-700' 
                    : 'bg-gradient-to-br from-white/80 to-white/60 border-white/40'
                }`}
                style={{
                  borderColor: continentColors[selectedLocation.continent].primary + '50',
                  boxShadow: `0 20px 60px -15px ${continentColors[selectedLocation.continent].glow}`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <h3 className={`text-3xl font-black ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>{selectedLocation.name}</h3>
                      {selectedLocation.isHome && (
                        <span className="text-3xl">🏠</span>
                      )}
                    </div>
                    {selectedLocation.country && (
                      <p className={`text-xl mb-6 font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{selectedLocation.country}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shadow-lg"
                        style={{
                          backgroundColor: continentColors[selectedLocation.continent].primary,
                          boxShadow: `0 0 20px ${continentColors[selectedLocation.continent].glow}`,
                        }}
                      />
                      <span className={`font-semibold text-lg ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
                        {continentColors[selectedLocation.continent].name}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className={`p-3 rounded-full transition-all duration-300 hover:shadow-lg ${
                      isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-2xl">✕</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Location list */}
        <div className="lg:col-span-1">
          <div className={`backdrop-blur-2xl border rounded-3xl shadow-2xl p-6 max-h-[580px] overflow-y-auto ${
            isDark 
              ? 'bg-gradient-to-br from-zinc-900/70 to-zinc-800/50 border-zinc-700' 
              : 'bg-gradient-to-br from-white/70 to-white/50 border-white/30'
          }`}>
            <h3 className={`font-black text-2xl mb-6 sticky top-0 backdrop-blur-2xl py-3 -mx-4 px-4 rounded-2xl ${
              isDark 
                ? 'bg-gradient-to-r from-zinc-900/95 to-zinc-800/85 text-zinc-100' 
                : 'bg-gradient-to-r from-white/95 to-white/85 text-gray-800'
            }`}>
              📍 Places visited
            </h3>
            {Object.entries(continentColors).map(([continentKey, color]) => {
              const continentLocations = locationsByContinent[continentKey as keyof typeof continentColors];
              if (!continentLocations?.length) return null;

              return (
                <div key={continentKey} className="mb-7">
                  <h4 className={`text-sm font-black mb-3 flex items-center gap-3 tracking-wide ${
                    isDark ? 'text-zinc-300' : 'text-gray-700'
                  }`}>
                    <div
                      className="w-5 h-5 rounded-full shadow-lg"
                      style={{
                        backgroundColor: color.primary,
                        boxShadow: `0 0 20px ${color.glow}`,
                      }}
                    />
                    {color.name}
                    <span className={`ml-auto text-xs px-3 py-1 rounded-full font-black ${
                      isDark 
                        ? 'bg-gradient-to-r from-zinc-800 to-zinc-700 text-zinc-300' 
                        : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
                    }`}>
                      {continentLocations.length}
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {continentLocations.map((loc, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedLocation(selectedLocation?.name === loc.name ? null : loc)}
                        className={`w-full text-left px-5 py-3.5 rounded-2xl text-sm transition-all duration-400 ${
                          selectedLocation?.name === loc.name
                            ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-2xl scale-[1.03]'
                            : isDark
                              ? 'bg-gradient-to-r from-zinc-800/60 to-zinc-700/40 hover:from-zinc-800/80 hover:to-zinc-700/60 text-zinc-300 hover:shadow-xl hover:scale-[1.01]'
                              : 'bg-gradient-to-r from-white/60 to-white/40 hover:from-white/80 hover:to-white/60 text-gray-700 hover:shadow-xl hover:scale-[1.01]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {loc.isHome && (
                            <span className="text-2xl">🏠</span>
                          )}
                          <span className="font-semibold text-base">{loc.name}</span>
                        </div>
                        {loc.country && (
                          <div className={`text-xs mt-1 ${
                            selectedLocation?.name === loc.name
                              ? 'text-gray-300'
                              : isDark ? 'text-zinc-500' : 'text-gray-400'
                          }`}>
                            {loc.country}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
