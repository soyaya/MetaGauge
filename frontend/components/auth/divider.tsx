export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-card px-4 text-muted-foreground">Or Continue with email</span>
      </div>
    </div>
  )
}
