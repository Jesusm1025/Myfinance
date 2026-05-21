import type { RefObject } from 'react'

export function scrollToElement(ref: RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
