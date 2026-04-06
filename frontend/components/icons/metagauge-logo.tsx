import Image from "next/image"

export function MetaGaugeLogo({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center ${className ?? ''}`}>
      {/* Light mode: black logo */}
      <Image
        src="/Black-Metagauge-logo.png"
        alt="MetaGauge"
        width={160}
        height={40}
        className="dark:hidden object-contain w-auto h-full"
        priority
      />
      {/* Dark mode: white logo */}
      <Image
        src="/White-Metagauge-logo.png"
        alt="MetaGauge"
        width={160}
        height={40}
        className="hidden dark:block object-contain w-auto h-full"
        priority
      />
    </div>
  )
}
