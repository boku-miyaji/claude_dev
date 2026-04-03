import { useEffect, useRef } from 'react'

interface Props {
  renderer: (root: HTMLElement) => Promise<void> | void
}

/**
 * Bridge component that runs legacy imperative render functions inside React.
 * During migration, each page starts as <LegacyPage renderer={renderXxx} />
 * and gets swapped to a native React component when migrated.
 */
export function LegacyPage({ renderer }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    // Clear previous content
    while (root.firstChild) root.removeChild(root.firstChild)

    // Create the .page wrapper the old renderers expect
    const page = document.createElement('div')
    page.className = 'page'
    root.appendChild(page)

    // Run the old imperative renderer
    renderer(page)

    return () => {
      while (root.firstChild) root.removeChild(root.firstChild)
    }
  }, [renderer])

  return <div ref={containerRef} />
}
