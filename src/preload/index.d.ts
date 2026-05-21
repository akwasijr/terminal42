import type { Terminal42Api } from './index'

declare global {
  interface Window {
    terminal42: Terminal42Api
  }
}
