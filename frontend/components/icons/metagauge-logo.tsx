import Image from "next/image"

export function MetaGaugeLogo({ className }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Light mode logo */}
      <Image
        src="/Black-Metagauge-logo.png"
        alt="MetaGauge Logo"
        width={150}
        height={150}
        className="dark:hidden"
        priority
      />
      {/* Dark mode logo */}
      <Image
        src="/White-Metagauge-logo.png"
        alt="MetaGauge Logo"
        width={150}
        height={150}
        className="hidden dark:block"
        priority
      />
    </div>
  )
}
