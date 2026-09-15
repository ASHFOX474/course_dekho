/**
 * lib/theme.ts
 * Comprehensive color theming system for role-based UI
 */

export type UserRole = 'learner' | 'contributor' | 'admin';

export interface RoleTheme {
  // Sidebar
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  
  // Navigation
  navActiveBg: string;
  navActiveText: string;
  navHoverBg: string;
  navHoverText: string;
  
  // Avatar
  avatarBg: string;
  avatarText: string;
  
  // Buttons
  primaryBg: string;
  primaryText: string;
  primaryHover: string;
  secondaryBg: string;
  secondaryText: string;
  
  // Forms & Inputs
  inputBorder: string;
  inputFocusBorder: string;
  inputFocusBg: string;
  
  // Badges & Tags
  badgeBg: string;
  badgeText: string;
  
  // Cards & Containers
  cardBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  
  // Links
  linkColor: string;
  linkHover: string;
  
  // Accent
  accentColor: string;
  accentLight: string;
  
  // Status
  successBg: string;
  warningBg: string;
  errorBg: string;
  
  // Dividers
  dividerColor: string;
}

const baseTheme = {
  sidebarText: 'text-slate-600',
  secondaryBg: 'bg-slate-100',
  secondaryText: 'text-slate-600',
};

export const themes: Record<UserRole, RoleTheme> = {
  learner: {
    // Sidebar
    sidebarBg: 'bg-blue-50',
    sidebarBorder: 'border-blue-200',
    sidebarText: baseTheme.sidebarText,
    
    // Navigation
    navActiveBg: 'bg-blue-100',
    navActiveText: 'text-blue-700',
    navHoverBg: 'hover:bg-blue-50',
    navHoverText: 'hover:text-blue-700',
    
    // Avatar
    avatarBg: 'bg-blue-600',
    avatarText: 'text-white',
    
    // Buttons
    primaryBg: 'bg-blue-600',
    primaryText: 'text-white',
    primaryHover: 'hover:bg-blue-700',
    secondaryBg: baseTheme.secondaryBg,
    secondaryText: baseTheme.secondaryText,
    
    // Forms & Inputs
    inputBorder: 'border-blue-200',
    inputFocusBorder: 'focus:border-blue-400',
    inputFocusBg: 'focus:bg-blue-50',
    
    // Badges & Tags
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    
    // Cards
    cardBg: 'bg-white',
    cardBorder: 'border-blue-100',
    cardHoverBorder: 'hover:border-blue-300',
    
    // Links
    linkColor: 'text-blue-600',
    linkHover: 'hover:text-blue-700',
    
    // Accent
    accentColor: 'text-blue-600',
    accentLight: 'text-blue-400',
    
    // Status
    successBg: 'bg-emerald-50',
    warningBg: 'bg-amber-50',
    errorBg: 'bg-red-50',
    
    // Dividers
    dividerColor: 'border-blue-100',
  },
  
  contributor: {
    // Sidebar
    sidebarBg: 'bg-emerald-50',
    sidebarBorder: 'border-emerald-200',
    sidebarText: baseTheme.sidebarText,
    
    // Navigation
    navActiveBg: 'bg-emerald-100',
    navActiveText: 'text-emerald-700',
    navHoverBg: 'hover:bg-emerald-50',
    navHoverText: 'hover:text-emerald-700',
    
    // Avatar
    avatarBg: 'bg-emerald-600',
    avatarText: 'text-white',
    
    // Buttons
    primaryBg: 'bg-emerald-600',
    primaryText: 'text-white',
    primaryHover: 'hover:bg-emerald-700',
    secondaryBg: baseTheme.secondaryBg,
    secondaryText: baseTheme.secondaryText,
    
    // Forms & Inputs
    inputBorder: 'border-emerald-200',
    inputFocusBorder: 'focus:border-emerald-400',
    inputFocusBg: 'focus:bg-emerald-50',
    
    // Badges & Tags
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    
    // Cards
    cardBg: 'bg-white',
    cardBorder: 'border-emerald-100',
    cardHoverBorder: 'hover:border-emerald-300',
    
    // Links
    linkColor: 'text-emerald-600',
    linkHover: 'hover:text-emerald-700',
    
    // Accent
    accentColor: 'text-emerald-600',
    accentLight: 'text-emerald-400',
    
    // Status
    successBg: 'bg-emerald-50',
    warningBg: 'bg-amber-50',
    errorBg: 'bg-red-50',
    
    // Dividers
    dividerColor: 'border-emerald-100',
  },
  
  admin: {
    // Sidebar
    sidebarBg: 'bg-slate-50',
    sidebarBorder: 'border-slate-200',
    sidebarText: baseTheme.sidebarText,
    
    // Navigation
    navActiveBg: 'bg-slate-100',
    navActiveText: 'text-slate-700',
    navHoverBg: 'hover:bg-slate-50',
    navHoverText: 'hover:text-slate-700',
    
    // Avatar
    avatarBg: 'bg-slate-600',
    avatarText: 'text-white',
    
    // Buttons
    primaryBg: 'bg-slate-600',
    primaryText: 'text-white',
    primaryHover: 'hover:bg-slate-700',
    secondaryBg: baseTheme.secondaryBg,
    secondaryText: baseTheme.secondaryText,
    
    // Forms & Inputs
    inputBorder: 'border-slate-200',
    inputFocusBorder: 'focus:border-slate-400',
    inputFocusBg: 'focus:bg-slate-50',
    
    // Badges & Tags
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    
    // Cards
    cardBg: 'bg-white',
    cardBorder: 'border-slate-100',
    cardHoverBorder: 'hover:border-slate-300',
    
    // Links
    linkColor: 'text-slate-600',
    linkHover: 'hover:text-slate-700',
    
    // Accent
    accentColor: 'text-slate-600',
    accentLight: 'text-slate-400',
    
    // Status
    successBg: 'bg-emerald-50',
    warningBg: 'bg-slate-50',
    errorBg: 'bg-red-50',
    
    // Dividers
    dividerColor: 'border-slate-100',
  },
};

export function getTheme(role: UserRole): RoleTheme {
  return themes[role] || themes.learner;
}
