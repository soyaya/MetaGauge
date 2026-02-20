export function LoadingScreen({ startupName, status }: { startupName: string; status?: string }) {
  return (
    <div className="fixed inset-0 bg-background/95 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="text-center">
        <div className="relative w-48 h-48 mx-auto mb-8">
          {/* Outer radar ring */}
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          {/* Middle radar ring */}
          <div className="absolute inset-6 rounded-full border-2 border-border" />
          {/* Inner radar ring */}
          <div className="absolute inset-12 rounded-full border-2 border-border" />
          
           {/* Rotating radar sweep - outer */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, rgba(107, 114, 128, 0.5) 0deg, rgba(107, 114, 128, 0) 90deg)',
              animation: 'radarSweep 3s linear infinite',
            }}
          />
          
          {/* Rotating radar sweep - middle */}
          <div
            className="absolute inset-6 rounded-full"
            style={{
              background: 'conic-gradient(from 180deg, rgba(156, 163, 175, 0.4) 0deg, rgba(156, 163, 175, 0) 90deg)',
              animation: 'radarSweep 4s linear infinite reverse',
            }}
          />
          
          {/* Pulsing center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-4 h-4">
              <div
                className="absolute inset-0 rounded-full bg-gray-400"
                style={{
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              <div
                className="absolute inset-1 rounded-full bg-gray-300"
                style={{
                  animation: 'pulse 2s ease-in-out infinite 0.3s',
                }}
              />
            </div>
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-2">
          Analyzing Blockchain Data...
        </h2>
        <p className="text-muted-foreground text-lg">Processing {startupName}</p>
        {status && (
          <p className="text-blue-600 text-sm mt-2 bg-blue-50 px-4 py-2 rounded-lg inline-block">
            {status}
          </p>
        )}
        <style>{`
          @keyframes radarSweep {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    </div>
  );
}