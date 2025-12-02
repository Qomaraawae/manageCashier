import { createContext, useContext, useState } from 'react'
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile 
} from 'firebase/auth'
import { auth } from '../firebase/config'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Register a new user
  const register = async (email, password, name) => {
    setLoading(true)
    setError('')
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(userCredential.user, { displayName: name })
      return userCredential.user
    } catch (error) {
      setError(error.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Login an existing user
  const login = async (email, password) => {
    setLoading(true)
    setError('')
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential.user
    } catch (error) {
      setError(error.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Logout the current user
  const logout = async () => {
    setLoading(true)
    setError('')
    
    try {
      await signOut(auth)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    setUser,
    register,
    login,
    logout,
    error,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}