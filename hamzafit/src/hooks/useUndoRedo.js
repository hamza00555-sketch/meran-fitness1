import { useState, useCallback } from 'react'

export function useUndoRedo(initialState) {
  const [history, setHistory] = useState([initialState])
  const [pointer, setPointer] = useState(0)

  const state = history[pointer]

  const setState = useCallback((newState) => {
    const value = newState instanceof Function ? newState(state) : newState
    const newHistory = history.slice(0, pointer + 1)
    newHistory.push(value)
    
    // Keep only last 50 states to prevent memory issues
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setPointer(newHistory.length - 1)
    }
    
    setHistory(newHistory)
  }, [state, history, pointer])

  const undo = useCallback(() => {
    if (pointer > 0) setPointer(pointer - 1)
  }, [pointer])

  const redo = useCallback(() => {
    if (pointer < history.length - 1) setPointer(pointer + 1)
  }, [pointer, history.length])

  const canUndo = pointer > 0
  const canRedo = pointer < history.length - 1

  return { state, setState, undo, redo, canUndo, canRedo }
}
