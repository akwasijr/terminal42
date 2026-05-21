export const labels = {
  app: 'Terminal42',
  nav: {
    terminal: 'Terminal',
    projects: 'Projects',
    skills: 'Skills',
    brain: 'Brain',
    recipes: 'Recipes',
    inbox: 'Inbox',
    preview: 'Preview',
    settings: 'Settings'
  },
  actions: {
    add: 'Add',
    addProject: 'Add a folder',
    addSession: 'New session',
    addCommand: 'Add a command',
    addRecipe: 'New recipe',
    addClip: 'New code clip',
    addPersona: 'New persona',
    addPrompt: 'New prompt',
    chooseFolder: 'Choose a folder',
    findAnything: 'Find anything',
    runRecipe: 'Run recipe',
    insert: 'Insert into message box',
    apply: 'Apply',
    open: 'Open',
    openInBrowser: 'Open in browser',
    copyUrl: 'Copy URL',
    restart: 'Restart',
    start: 'Start',
    stop: 'Stop',
    rename: 'Rename',
    pin: 'Pin',
    unpin: 'Unpin',
    remove: 'Remove',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    send: 'Send',
    delete: 'Delete'
  },
  copy: {
    findAnythingHint: 'Search projects, sessions, recipes, settings…',
    composerPlaceholder: 'Ask Copilot anything…',
    noProjects: 'No projects yet. Click + to add a folder.',
    noSessions: 'No sessions yet.',
    noTasks: 'No plan found yet for this session.',
    noProcesses: 'Nothing running right now.',
    noRecipes: 'No recipes yet.',
    noClips: 'No code clips yet.',
    schedulerOnlyOpen: 'Scheduled recipes only run while Terminal42 is open.',
    portTaken: (req: number, used: number) => `Port ${req} was taken, opened on ${used} instead.`,
    brainCount: (n: number) => `${n} rule${n === 1 ? '' : 's'} active`,
    aboutBrain:
      'Brain is your personal preferences. It is shown to Copilot at the start of each session so it knows what you like.'
  },
  status: {
    starting: 'Starting…',
    running: 'Running',
    ready: 'Ready',
    stopped: 'Stopped',
    failed: 'Failed',
    queued: 'Queued',
    done: 'Done'
  },
  modes: {
    light: 'Switch to light mode',
    dark: 'Switch to dark mode'
  }
} as const

export type Labels = typeof labels
