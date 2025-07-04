import { renderHook, act } from '@testing-library/react'
import { useState, useCallback } from 'react'

interface FragmentVersion {
  fragment: any
  result?: any
  timestamp: number
}

// Test the fragment versioning logic
describe('Fragment Versioning', () => {
  it('should add new fragment versions correctly', () => {
    const { result } = renderHook(() => {
      const [fragmentVersions, setFragmentVersions] = useState<FragmentVersion[]>([])
      const [currentVersionIndex, setCurrentVersionIndex] = useState(-1)

      const addVersion = useCallback((fragment: any, result: any) => {
        const newVersion: FragmentVersion = {
          fragment,
          result,
          timestamp: Date.now()
        }
        setFragmentVersions(prev => [...prev, newVersion])
        setCurrentVersionIndex(prev => prev + 1)
      }, [])

      return { fragmentVersions, currentVersionIndex, addVersion }
    })

    // Add first version
    act(() => {
      result.current.addVersion({ code: 'v1' }, { url: 'test1' })
    })

    expect(result.current.fragmentVersions).toHaveLength(1)
    expect(result.current.currentVersionIndex).toBe(0)
    expect(result.current.fragmentVersions[0].fragment.code).toBe('v1')

    // Add second version
    act(() => {
      result.current.addVersion({ code: 'v2' }, { url: 'test2' })
    })

    expect(result.current.fragmentVersions).toHaveLength(2)
    expect(result.current.currentVersionIndex).toBe(1)
    expect(result.current.fragmentVersions[1].fragment.code).toBe('v2')
  })

  it('should navigate between versions correctly', () => {
    const { result } = renderHook(() => {
      const [fragmentVersions] = useState<FragmentVersion[]>([
        { fragment: { code: 'v1' }, result: { url: 'test1' }, timestamp: 1 },
        { fragment: { code: 'v2' }, result: { url: 'test2' }, timestamp: 2 },
        { fragment: { code: 'v3' }, result: { url: 'test3' }, timestamp: 3 }
      ])
      const [currentVersionIndex, setCurrentVersionIndex] = useState(2)

      const navigateToVersion = useCallback((index: number) => {
        if (index >= 0 && index < fragmentVersions.length) {
          setCurrentVersionIndex(index)
        }
      }, [fragmentVersions])

      const goToPreviousVersion = useCallback(() => {
        if (currentVersionIndex > 0) {
          navigateToVersion(currentVersionIndex - 1)
        }
      }, [currentVersionIndex, navigateToVersion])

      const goToNextVersion = useCallback(() => {
        if (currentVersionIndex < fragmentVersions.length - 1) {
          navigateToVersion(currentVersionIndex + 1)
        }
      }, [currentVersionIndex, fragmentVersions.length, navigateToVersion])

      return {
        fragmentVersions,
        currentVersionIndex,
        goToPreviousVersion,
        goToNextVersion
      }
    })

    expect(result.current.currentVersionIndex).toBe(2)

    // Navigate to previous version
    act(() => {
      result.current.goToPreviousVersion()
    })
    expect(result.current.currentVersionIndex).toBe(1)

    // Navigate to previous version again
    act(() => {
      result.current.goToPreviousVersion()
    })
    expect(result.current.currentVersionIndex).toBe(0)

    // Try to go beyond first version (should stay at 0)
    act(() => {
      result.current.goToPreviousVersion()
    })
    expect(result.current.currentVersionIndex).toBe(0)

    // Navigate forward
    act(() => {
      result.current.goToNextVersion()
    })
    expect(result.current.currentVersionIndex).toBe(1)

    // Navigate to last version
    act(() => {
      result.current.goToNextVersion()
    })
    expect(result.current.currentVersionIndex).toBe(2)

    // Try to go beyond last version (should stay at 2)
    act(() => {
      result.current.goToNextVersion()
    })
    expect(result.current.currentVersionIndex).toBe(2)
  })
}) 