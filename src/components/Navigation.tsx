import React, { useState } from 'react';
import {
  Home,
  Compass,
  Radio,
  Sparkles,
  Users,
  UploadCloud,
  Library,
  BarChart3,
  ShieldAlert,
  Gem,
  Search,
  Bell,
  Menu,
  X,
  ChevronRight,
  CheckCircle2,
  Heart,
  Download,
  LogIn,
  LogOut,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { HavenTab, TrackTakedownNotice } from '../types/index.ts';
import { HavenLogo } from './HavenLogo.tsx';
import { isAdminUser } from '../utils/accessControl.ts';

interface NavigationProps {
  currentTab: HavenTab;
  onSelectTab: (tab: HavenTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSearch: () => void;
  unreadCount?: number;
  takedowns?: TrackTakedownNotice[];
  activeRoomCode?: string | null;
  userTier?: 'Free' | 'Haven Pro';
  authUser: User | null;
  authLoading?: boolean;
  onSignInGoogle: () => void;
  onSignOut: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  onOpenSearch,
  unreadCount = 2,
  takedowns = [],
  activeRoomCode = null,
  userTier = 'Haven Pro',
  authUser,
  authLoading = false,
  onSignInGoogle,
  onSignOut,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const isAdmin = isAdminUser(authUser);

  const mainNavItems: { id: HavenTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'genres', label: 'Genres & Moods', icon: Radio },
    { id: 'ai-discovery', label: 'AI Discovery', icon: Sparkles, badge: 'Smart' },
    { id: 'rooms', label: 'Rooms', icon: Users, badge: activeRoomCode || 'Sync' },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'upload', label: 'Upload Song', icon: UploadCloud, badge: 'Batch' },
    { id: 'library', label: 'My Library', icon: Library },
  ];

  const secondaryNavItems: { id: HavenTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'creator-dashboard', label: 'Creator Analytics', icon: BarChart3 },
    { id: 'pricing', label: 'Haven Pro', icon: Gem },
    ...(isAdmin ? [{ id: 'admin' as HavenTab, label: 'Admin Dashboard', icon: ShieldAlert }] : []),
  ];

  const creatorTakedownNotifs = authUser
    ? takedowns
        .filter((td) => td.targetUploaderUid === authUser.uid)
        .map((td) => ({
          id: `td-${td.id}`,
          title: `Takedown Notice: ${td.trackTitle}`,
          desc: td.reason,
          time: td.createdAt || 'Recently',
          icon: AlertTriangle,
          iconColor: 'text-[#EF4444]',
        }))
    : [];

  const effectiveUnreadCount = unreadCount + creatorTakedownNotifs.length;

  const notifications = [
    ...creatorTakedownNotifs,
    {
      id: 'n-1',
      title: 'New Track Liked',
      desc: 'Elena Rostova liked "Obsidian Resonance"',
      time: '10m ago',
      icon: Heart,
      iconColor: 'text-[#8B5CF6]',
    },
    {
      id: 'n-2',
      title: 'Download Milestone',
      desc: '"Bioluminescent Dawn" reached 1,000 community downloads!',
      time: '1h ago',
      icon: Download,
      iconColor: 'text-[#06B6D4]',
    },
    {
      id: 'n-3',
      title: 'Category Verified',
      desc: 'All 8 metadata attributes confirmed for "Lagos Neon Mirage"',
      time: '3h ago',
      icon: CheckCircle2,
      iconColor: 'text-[#10B981]',
    },
  ];

  const handleTabClick = (tab: HavenTab) => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
  };

  const displayName = authUser?.displayName || 'Haven Creator';
  const shortName = displayName.split(' ')[0];

  return (
    <>
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-30 h-16 bg-[#08080C]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 lg:px-8">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => handleTabClick('home')}
            className="flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8B5CF6]/70 via-[#06B6D4]/70 to-[#10B981]/70 p-[1.5px] shadow-[0_0_20px_rgba(139,92,246,0.3)] group-hover:shadow-[0_0_26px_rgba(6,182,212,0.5)] transition-all">
              <div className="w-full h-full bg-[#08080C] rounded-[10px] flex items-center justify-center">
                <HavenLogo size={24} className="transition-transform duration-300 group-hover:scale-105" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                AI Music Haven
                <span className="hidden sm:inline text-[9px] font-mono-tech px-1.5 py-0.2 rounded bg-[#8B5CF6]/20 text-[#06B6D4] border border-[#8B5CF6]/30 uppercase tracking-widest">
                  GLOBAL
                </span>
              </span>
              <span className="hidden sm:block text-[11px] text-[#958ea0] font-sans tracking-wide">
                Where AI Music Finds Its Home.
              </span>
            </div>
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#958ea0] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={onOpenSearch}
              placeholder="Search 14,000+ AI tracks, genres, moods, creators..."
              className="w-full bg-[#161622]/80 hover:bg-[#161622] focus:bg-[#161622] text-xs text-white placeholder-[#958ea0] pl-10 pr-4 py-2 rounded-xl border border-white/10 focus:border-[#06B6D4]/50 focus:outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Right: Quick actions & Google Account */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Upload Button */}
          <button
            onClick={() => handleTabClick('upload')}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all transform active:scale-95"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Song</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl text-[#958ea0] hover:text-white hover:bg-white/5 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {effectiveUnreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#06B6D4] ring-2 ring-[#08080C]" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#161622] border border-white/10 p-3 shadow-2xl z-50 backdrop-blur-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                  <span className="font-display font-semibold text-xs text-white">Notifications</span>
                  <span className="text-[10px] font-mono-tech text-[#06B6D4]">{effectiveUnreadCount} new</span>
                </div>
                <div className="space-y-1.5">
                  {notifications.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div
                        key={n.id}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors flex gap-2.5 items-start cursor-pointer"
                      >
                        <div className="p-1.5 rounded-lg bg-white/5 shrink-0 mt-0.5">
                          <Icon className={`w-3.5 h-3.5 ${n.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-white truncate">{n.title}</span>
                            <span className="text-[9px] font-mono-tech text-[#958ea0]">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-[#958ea0] line-clamp-2 mt-0.5">{n.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Auth User State */}
          {authUser ? (
            <div className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-xl bg-white/[0.03] border border-white/10">
              {isAdmin && (
                <button
                  onClick={() => handleTabClick('admin')}
                  className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono-tech transition-colors ${
                    currentTab === 'admin'
                      ? 'bg-[#EF4444]/25 text-white border border-[#EF4444]/50'
                      : 'bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25 border border-[#EF4444]/30'
                  }`}
                  title="Open Admin Dashboard"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Admin</span>
                </button>
              )}
              <button
                onClick={() => handleTabClick(isAdmin ? 'admin' : 'creator-dashboard')}
                className="flex items-center gap-2 px-1 py-0.5 rounded-lg hover:bg-white/5 transition-colors"
                title={`Signed in as ${displayName}`}
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#10B981]/50 bg-[#161622] flex items-center justify-center text-xs font-bold text-[#06B6D4]">
                  {authUser.photoURL ? (
                    <img
                      src={authUser.photoURL}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{shortName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-white leading-tight max-w-[110px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[9px] font-mono-tech text-[#10B981] flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {isAdmin ? 'Admin Verified' : `Google Verified · ${userTier}`}
                  </span>
                </div>
              </button>
              <button
                onClick={onSignOut}
                className="p-1.5 rounded-lg text-[#958ea0] hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignInGoogle}
              disabled={authLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/15 hover:border-[#06B6D4]/50 transition-all disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span className="hidden sm:inline">{authLoading ? 'Connecting...' : 'Sign in with Google'}</span>
              <span className="sm:hidden">Sign in</span>
            </button>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl text-[#958ea0] hover:text-white hover:bg-white/5 lg:hidden"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Horizontal Category / Main Navigation Rail */}
      <nav className="sticky top-16 z-20 bg-[#08080C]/80 backdrop-blur-md border-b border-white/5 px-4 lg:px-8 hidden lg:flex items-center justify-between overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 py-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#161622] text-white shadow-[0_0_12px_rgba(139,92,246,0.25)] border border-[#8B5CF6]/40'
                    : 'text-[#958ea0] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#06B6D4]' : 'text-[#958ea0]'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-mono-tech px-1 rounded bg-[#8B5CF6]/30 text-[#acedff] border border-[#8B5CF6]/40">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 py-2">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-tech transition-colors ${
                  isActive
                    ? 'bg-[#161622] text-[#06B6D4] border border-[#06B6D4]/40'
                    : 'text-[#958ea0] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-16 bg-[#08080C]/98 backdrop-blur-2xl z-40 p-4 flex flex-col justify-between overflow-y-auto lg:hidden">
          <div className="space-y-4">
            {/* Mobile Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#958ea0] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search AI songs, creators, moods..."
                className="w-full bg-[#161622] text-xs text-white placeholder-[#958ea0] pl-10 pr-4 py-2.5 rounded-xl border border-white/10"
              />
            </div>

            {/* Mobile Auth Card */}
            <div className="p-3 rounded-2xl bg-[#161622] border border-white/10 flex items-center justify-between">
              {authUser ? (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#10B981]/50 bg-[#08080C] flex items-center justify-center text-xs font-bold text-[#06B6D4] shrink-0">
                      {authUser.photoURL ? (
                        <img src={authUser.photoURL} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{shortName.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{displayName}</div>
                      <div className="text-[10px] font-mono-tech text-[#10B981]">Google Account Verified</div>
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white hover:bg-white/10"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onSignInGoogle();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign in with Google to Upload</span>
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono-tech uppercase tracking-wider text-[#958ea0] px-3 block mb-1">
                Explore The Haven
              </span>
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all ${
                      isActive
                        ? 'bg-[#161622] text-white border border-[#8B5CF6]/40 font-semibold'
                        : 'text-[#958ea0] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#06B6D4]' : 'text-[#958ea0]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-[#8B5CF6]/30 text-[#acedff]">
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 opacity-40" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Secondary Navigation */}
            <div className="space-y-1 pt-3 border-t border-white/5">
              <span className="text-[10px] font-mono-tech uppercase tracking-wider text-[#958ea0] px-3 block mb-1">
                Creator & Platform
              </span>
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono-tech transition-colors ${
                      isActive
                        ? 'bg-[#161622] text-[#06B6D4]'
                        : 'text-[#958ea0] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Footer */}
          <div className="pt-4 border-t border-white/5 text-[11px] font-mono-tech text-[#958ea0] flex items-center justify-between">
            <span>AI Music Haven</span>
            <span className="text-[#06B6D4]">Global Library Active</span>
          </div>
        </div>
      )}
    </>
  );
};
