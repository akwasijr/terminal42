import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

const make = (path: React.ReactNode) =>
  function Icon({ size = 16, ...props }: Props) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    )
  }

export const IconTerminal = make(
  <>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M5 7 L7 8.5 L5 10 M8.5 10 H11" />
  </>
)
export const IconFolder = make(
  <path d="M2 5C2 4.4 2.4 4 3 4h3.6c.3 0 .5.1.7.3L8 5h5c.6 0 1 .4 1 1v6c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V5Z" />
)
export const IconSparkle = make(<path d="M8 2 L9.5 6.5 L14 8 L9.5 9.5 L8 14 L6.5 9.5 L2 8 L6.5 6.5 Z" />)
export const IconUser = make(
  <>
    <circle cx="8" cy="6" r="2.5" />
    <path d="M3 13c.5-2 2.5-3.5 5-3.5s4.5 1.5 5 3.5" />
  </>
)
export const IconWorkflow = make(
  <>
    <circle cx="4" cy="4" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <path d="M4 5.5V10c0 1.1.9 2 2 2h4.5" />
  </>
)
export const IconCode = make(<path d="M5 5 L2 8 L5 11 M11 5 L14 8 L11 11 M9.5 4 L7 12" />)
export const IconSearch = make(
  <>
    <circle cx="7" cy="7" r="4" />
    <path d="M10 10 L13 13" />
  </>
)
export const IconGear = make(
  <>
    <path d="M9.4 1.6a.6.6 0 0 0-.6-.5H7.2a.6.6 0 0 0-.6.5l-.2 1.2a5 5 0 0 0-1.2.7l-1.1-.5a.6.6 0 0 0-.7.2L2.6 4.8a.6.6 0 0 0 .1.7l.9.8a5 5 0 0 0 0 1.4l-.9.8a.6.6 0 0 0-.1.7l.8 1.6a.6.6 0 0 0 .7.2l1.1-.5q.55.45 1.2.7l.2 1.2a.6.6 0 0 0 .6.5h1.6a.6.6 0 0 0 .6-.5l.2-1.2q.65-.25 1.2-.7l1.1.5a.6.6 0 0 0 .7-.2l.8-1.6a.6.6 0 0 0-.1-.7l-.9-.8a5 5 0 0 0 0-1.4l.9-.8a.6.6 0 0 0 .1-.7l-.8-1.6a.6.6 0 0 0-.7-.2l-1.1.5a5 5 0 0 0-1.2-.7Z" />
    <circle cx="8" cy="8" r="2.2" />
  </>
)
export const IconMoon = make(
  <path d="M13 9.5C12.4 11.5 10.5 13 8.2 13 5.3 13 3 10.7 3 7.8 3 5.5 4.5 3.6 6.5 3c-.3.7-.5 1.5-.5 2.3 0 2.9 2.3 5.2 5.2 5.2.8 0 1.6-.2 1.8-1Z" />
)
export const IconSun = make(
  <>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
  </>
)
export const IconPlus = make(<path d="M8 3.5v9M3.5 8h9" />)
export const IconChat = make(
  <path d="M3 4h10c.6 0 1 .4 1 1v5c0 .6-.4 1-1 1H7l-3 2.5V11H3c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1Z" />
)
export const IconCheck = make(<path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />)
export const IconChevronRight = make(<path d="M6 4 L10 8 L6 12" />)
export const IconPaperPlane = make(<path d="M14 2 L2 7 L7 9 L9 14 Z M7 9 L14 2" />)
export const IconArrowUp = make(<path d="M8 13 V3 M3.5 7.5 L8 3 L12.5 7.5" />)
export const IconBranch = make(
  <>
    <circle cx="4" cy="3.5" r="1.5" />
    <circle cx="4" cy="12.5" r="1.5" />
    <circle cx="12" cy="6" r="1.5" />
    <path d="M4 5 V11" />
    <path d="M4 8 c0-2 2-2.5 4-2.5 c2 0 3 -.5 3.5 -1" />
  </>
)
export const IconWorktree = make(
  <>
    <circle cx="4" cy="3.5" r="1.5" />
    <circle cx="12" cy="3.5" r="1.5" />
    <circle cx="8" cy="12.5" r="1.5" />
    <path d="M4 5 c0 3 1 4 4 4 s4-1 4-4" />
    <path d="M8 9 V11" />
  </>
)
export const IconStop = make(<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none" />)
export const IconClose = make(<path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" />)
export const IconBolt = make(<path d="M9 2 L4 9 H8 L7 14 L12 7 H8 L9 2 Z" />)
export const IconExternal = make(<><path d="M9 2 H14 V7" /><path d="M14 2 L8 8" /><path d="M12 9 V13 c0 .5-.5 1-1 1 H3 c-.5 0-1-.5-1-1 V5 c0-.5.5-1 1-1 H7" /></>)
export const IconCopy = make(<><rect x="5" y="5" width="9" height="9" rx="1" /><path d="M11 5 V3 c0-.5-.5-1-1-1 H3 c-.5 0-1 .5-1 1 V10 c0 .5.5 1 1 1 H5" /></>)
export const IconRefresh = make(<><path d="M3 8 a5 5 0 1 1 1.5 3.5" /><path d="M3 13 V11 H5" /></>)
export const IconBell = make(<><path d="M8 2 c-2.2 0-4 1.8-4 4 v3 l-1.2 1.5 H13.2 L12 9 V6 c0-2.2-1.8-4-4-4 Z" /><path d="M6.8 12.5 c0 .7.5 1.2 1.2 1.2 s1.2-.5 1.2-1.2" /></>)
export const IconPlay = make(<path d="M5 3.5 L13 8 L5 12.5 Z" />)
export const IconInbox = make(<><path d="M2 5 L4 10 H12 L14 5 V13 H2 Z" /><path d="M5 10 H7 V12 H9 V10 H11" /></>)
export const IconBrain = make(
  <>
    <path d="M5 4c-1.5 0-2.5 1-2.5 2.5 0 .5.2 1 .5 1.4-.5.5-.7 1.2-.5 1.9.3 1 1.2 1.7 2.2 1.7v1c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5V4.5C7.7 4.2 7 4 5 4Z" />
    <path d="M11 4c1.5 0 2.5 1 2.5 2.5 0 .5-.2 1-.5 1.4.5.5.7 1.2.5 1.9-.3 1-1.2 1.7-2.2 1.7v1c0 .8-.7 1.5-1.5 1.5S8.3 13.3 8.3 12.5V4.5C8.3 4.2 9 4 11 4Z" />
  </>
)
export const IconEdit = make(
  <>
    <path d="M11 2.5 L13.5 5 L5.5 13 H3 V10.5 Z" />
    <path d="M10 3.5 L12.5 6" />
  </>
)
export const IconDownload = make(
  <>
    <path d="M8 2 V10" />
    <path d="M4.5 6.5 L8 10 L11.5 6.5" />
    <path d="M3 13 H13" />
  </>
)
export const IconPaperclip = make(
  <>
    <path d="M12 5.5 L6.2 11.3 a2.4 2.4 0 0 1-3.4-3.4 L9 1.7 a3.5 3.5 0 0 1 5 5 L7.7 13 a4.5 4.5 0 0 1-6.4-6.4" />
  </>
)
export const IconMic = make(
  <>
    <rect x="6" y="2" width="4" height="8" rx="2" />
    <path d="M3.5 8 a4.5 4.5 0 0 0 9 0" />
    <path d="M8 12.5 V14.5" />
    <path d="M5.5 14.5 H10.5" />
  </>
)
export const IconTrash = make(
  <>
    <path d="M3 4.5 H13" />
    <path d="M5 4.5 V3.5 c0-.5.5-1 1-1 H10 c.5 0 1 .5 1 1 V4.5" />
    <path d="M4 4.5 L4.5 13 c0 .5.5 1 1 1 H10.5 c.5 0 1-.5 1-1 L12 4.5" />
  </>
)
export const IconTheme = make(
  <>
    <circle cx="8" cy="8" r="5" />
    <path d="M8 3 a5 5 0 0 0 0 10 Z" fill="currentColor" stroke="none" />
  </>
)
export const IconClock = make(
  <>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5 V8 L10 9.5" />
  </>
)

export const IconThumbUp = make(
  <>
    <path d="M5 7v6.5h6.4c.6 0 1.1-.4 1.2-1l.7-3.8c.1-.7-.4-1.2-1.1-1.2H9.5l.6-2.5c.1-.6-.3-1.2-1-1.2-.4 0-.7.2-.9.5L5 7Z" />
    <path d="M2.5 7H5V13.5H2.5z" />
  </>
)
export const IconThumbDown = make(
  <>
    <path d="M11 9V2.5H4.6c-.6 0-1.1.4-1.2 1L2.7 7.3c-.1.7.4 1.2 1.1 1.2h2.7l-.6 2.5c-.1.6.3 1.2 1 1.2.4 0 .7-.2.9-.5L11 9Z" />
    <path d="M11 2.5h2.5V9H11z" />
  </>
)

export const IconMobile = make(
  <>
    <rect x="5" y="2" width="6" height="12" rx="1.25" />
    <path d="M7.5 12 H8.5" />
  </>
)
export const IconTablet = make(
  <>
    <rect x="3.5" y="2" width="9" height="12" rx="1.25" />
    <path d="M7 12.25 H9" />
  </>
)
export const IconDesktop = make(
  <>
    <rect x="2" y="3" width="12" height="8" rx="1" />
    <path d="M5.5 13.5 H10.5 M8 11 V13.5" />
  </>
)
export const IconFluid = make(
  <>
    <rect x="2" y="3" width="12" height="10" rx="1.25" />
    <path d="M4.5 8 H6.5 M9.5 8 H11.5 M5.5 6 L4 8 L5.5 10 M10.5 6 L12 8 L10.5 10" />
  </>
)
// Loom icon — interlocking weave lines suggesting threads being woven.
export const IconLoom = make(
  <>
    <path d="M2.5 4 H13.5 M2.5 8 H13.5 M2.5 12 H13.5" />
    <path d="M5 2.5 V13.5 M8 2.5 V13.5 M11 2.5 V13.5" />
  </>
)
export const IconGlobe = make(
  <>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8 H13.5 M8 2.5 c2 2 2 9 0 11 M8 2.5 c-2 2-2 9 0 11" />
  </>
)
export const IconDocument = make(
  <>
    <path d="M4 2 H10 L13 5 V14 H4 Z" />
    <path d="M10 2 V5 H13 M6 8 H11 M6 10.5 H11" />
  </>
)
export const IconText = make(
  <>
    <path d="M3 4 H13 M5 7 H11 M3 10 H13 M5 13 H11" />
  </>
)
export const IconBriefing = make(
  <>
    <rect x="3" y="3" width="10" height="11" rx="1" />
    <path d="M5.5 6 H10.5 M5.5 8.5 H10.5 M5.5 11 H8.5" />
  </>
)
export const IconList = make(
  <>
    <circle cx="3.5" cy="4.5" r=".7" fill="currentColor" />
    <circle cx="3.5" cy="8" r=".7" fill="currentColor" />
    <circle cx="3.5" cy="11.5" r=".7" fill="currentColor" />
    <path d="M6 4.5 H13 M6 8 H13 M6 11.5 H13" />
  </>
)
export const IconMindMap = make(
  <>
    <circle cx="3" cy="8" r="1.4" />
    <circle cx="12" cy="3.5" r="1.4" />
    <circle cx="12" cy="8" r="1.4" />
    <circle cx="12" cy="12.5" r="1.4" />
    <path d="M4.4 8 H10.6 M4 7.2 L10.7 3.8 M4 8.8 L10.7 12.2" />
  </>
)
export const IconFaq = make(
  <>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M6.2 6.5 c0-1 .8-1.8 1.8-1.8 s1.8.8 1.8 1.8 c0 .9-.7 1.3-1.3 1.6 c-.4.2-.5.5-.5.9" />
    <circle cx="8" cy="11.2" r=".6" fill="currentColor" stroke="none" />
  </>
)
/** Form / freeform canvas: a frame split into panels. */
export const IconLayout = make(
  <>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M8 3 V13" />
    <path d="M8 8 H13.5" />
  </>
)
export const IconCards = make(  <>
    <rect x="3" y="5" width="8" height="9" rx="1" />
    <path d="M5 3 H13 V12" />
  </>
)
export const IconQuiz = make(
  <>
    <rect x="2.5" y="3" width="11" height="10" rx="1" />
    <circle cx="5" cy="6" r=".6" fill="currentColor" stroke="none" />
    <circle cx="5" cy="8" r=".6" fill="currentColor" stroke="none" />
    <circle cx="5" cy="10" r=".6" fill="currentColor" stroke="none" />
    <path d="M7 6 H11.5 M7 8 H11.5 M7 10 H11.5" />
  </>
)
export const IconTable = make(
  <>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
    <path d="M2.5 7 H13.5 M2.5 10 H13.5 M6 3.5 V12.5 M10 3.5 V12.5" />
  </>
)
export const IconClipboard = make(
  <>
    <rect x="4" y="3" width="8" height="11" rx="1" />
    <path d="M6 3 V2 H10 V3 M6.5 7 H9.5 M6.5 9.5 H9.5" />
  </>
)
export const IconStack = make(
  <>
    <path d="M2.5 5 L8 2.5 L13.5 5 L8 7.5 Z" />
    <path d="M2.5 8 L8 10.5 L13.5 8" />
    <path d="M2.5 11 L8 13.5 L13.5 11" />
  </>
)

export const IconExpand = make(
  <>
    <path d="M9.5 2.5 H13.5 V6.5" />
    <path d="M6.5 13.5 H2.5 V9.5" />
    <path d="M13.5 2.5 L9 7" />
    <path d="M2.5 13.5 L7 9" />
  </>
)

export const IconCollapse = make(
  <>
    <path d="M13 3 L9 7 M9 7 V3.5 M9 7 H12.5" />
    <path d="M3 13 L7 9 M7 9 V12.5 M7 9 H3.5" />
  </>
)
