export const validateEmail = (email: string): string | null => {
  if (!email) return "Email is required"
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return "Please enter a valid email address"
  return null
}

export const validatePassword = (password: string): string | null => {
  if (!password) return "Password is required"
  if (password.length < 8) return "Password must be at least 8 characters"
  if (!/(?=.*[a-z])/.test(password)) return "Password must contain at least one lowercase letter"
  if (!/(?=.*[A-Z])/.test(password)) return "Password must contain at least one uppercase letter"
  if (!/(?=.*\d)/.test(password)) return "Password must contain at least one number"
  return null
}

export const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0
  
  if (password.length >= 8) score++
  if (/(?=.*[a-z])/.test(password)) score++
  if (/(?=.*[A-Z])/.test(password)) score++
  if (/(?=.*\d)/.test(password)) score++
  if (/(?=.*[!@#$%^&*])/.test(password)) score++
  
  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" }
  if (score <= 3) return { score, label: "Fair", color: "bg-yellow-500" }
  if (score <= 4) return { score, label: "Good", color: "bg-blue-500" }
  return { score, label: "Strong", color: "bg-green-500" }
}
