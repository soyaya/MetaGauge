export function WizardStep({ step, totalSteps }: { step: number; totalSteps: number }) {
  const labels = ['Project Details', 'Competitors', 'Analysis Settings'];
  
  return (
    <div className="mb-12">
      {/* Step indicators with connecting lines */}
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="flex items-center flex-1">
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${
                  i < step ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      
      {/* Step labels centered under each number */}
      <div className="flex justify-between max-w-2xl mx-auto">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <p
              className={`text-sm font-medium ${
                i <= step ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}