import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Login } from './pages/Login';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ServerDetail } from './pages/ServerDetail';
import { Nodes } from './pages/Nodes';
import { Templates } from './pages/Templates';
import { UsersPage } from './pages/Users';
import { AuditLogs } from './pages/AuditLogs';
import { SettingsPage } from './pages/Settings';
import { ProfilePage } from './pages/Profile';
import { OnboardingGuideModal } from './components/OnboardingGuideModal';

const MainLayout: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [currentTab, setCurrentTab] = useState<string>('servers');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [initialServerTab, setInitialServerTab] = useState<string>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      const hideGuide = localStorage.getItem('zyrocloud_hide_onboarding');
      if (!hideGuide) {
        setIsGuideOpen(true);
      }
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-xs text-slate-400 font-mono">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent mb-3" />
        <span>AUTHENTICATING SECURE CLUSTER...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleSelectServer = (serverId: string, initialTab: string = 'overview') => {
    setSelectedServerId(serverId);
    setInitialServerTab(initialTab);
    setCurrentTab('servers');
    setIsMobileMenuOpen(false);
  };

  const handleBackToServers = () => {
    setSelectedServerId(null);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
      <Header
        activeTab={currentTab}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onNavigateToProfile={() => {
          setCurrentTab('profile');
          setSelectedServerId(null);
          setIsMobileMenuOpen(false);
        }}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      <div className="flex-1 flex min-w-0">
        <Sidebar
          currentTab={currentTab}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setSelectedServerId(null);
            setIsMobileMenuOpen(false);
          }}
        />

        <main className="flex-1 min-w-0 p-3 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentTab === 'servers' && (
            <>
              {selectedServerId ? (
                <ServerDetail
                  serverId={selectedServerId}
                  initialTab={initialServerTab}
                  onBack={handleBackToServers}
                />
              ) : (
                <Dashboard onSelectServer={handleSelectServer} />
              )}
            </>
          )}

          {currentTab === 'nodes' && isAdmin && <Nodes />}
          {currentTab === 'templates' && isAdmin && <Templates />}
          {currentTab === 'users' && isAdmin && <UsersPage />}
          {currentTab === 'audit' && isAdmin && <AuditLogs />}
          {currentTab === 'settings' && isAdmin && <SettingsPage />}
          {currentTab === 'profile' && <ProfilePage />}
        </main>
      </div>

      <OnboardingGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <MainLayout />
      </SettingsProvider>
    </AuthProvider>
  );
}
