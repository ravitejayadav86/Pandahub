"use client";
import { useState } from 'react';
import DashboardNav from '../(dashboard)/DashboardNav';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="min-h-screen bg-background text-on-surface font-body flex flex-col">
      <DashboardNav />
      
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col md:flex-row gap-12">
        
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <h1 className="text-3xl font-display font-extrabold mb-8 text-on-surface">Settings</h1>
          <nav className="flex flex-col gap-2">
            {[
              { id: 'profile', icon: 'person', label: 'Public Profile' },
              { id: 'account', icon: 'manage_accounts', label: 'Account' },
              { id: 'appearance', icon: 'palette', label: 'Appearance' },
              { id: 'notifications', icon: 'notifications', label: 'Notifications' },
              { id: 'billing', icon: 'credit_card', label: 'Billing' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold text-left ${
                  activeTab === tab.id 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: activeTab === tab.id ? '"FILL" 1' : '"FILL" 0'}}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-card rounded-3xl p-8 md:p-10"
          >
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold font-headline mb-2">Public Profile</h2>
                  <p className="text-on-surface-variant text-sm">Update your username, bio, and avatar.</p>
                </div>
                
                <div className="flex items-center gap-6 pb-6 border-b border-outline-variant/50">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                    AL
                  </div>
                  <div className="flex flex-col gap-3">
                    <button className="btn-glass px-4 py-2 rounded-lg text-sm font-semibold hover:bg-surface-variant transition-colors">
                      Upload new picture
                    </button>
                    <button className="text-error text-sm font-medium hover:underline text-left">
                      Remove
                    </button>
                  </div>
                </div>

                <form className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-surface">Name</label>
                    <input type="text" defaultValue="Alex Chen" className="input-glass px-4 py-3 rounded-xl w-full text-sm outline-none transition-all" />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-surface">Bio</label>
                    <textarea rows={4} className="input-glass px-4 py-3 rounded-xl w-full text-sm outline-none transition-all resize-none" placeholder="Tell us a little bit about yourself..."></textarea>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-surface">URL</label>
                    <input type="url" placeholder="https://example.com" className="input-glass px-4 py-3 rounded-xl w-full text-sm outline-none transition-all" />
                  </div>

                  <div className="pt-6">
                    <button type="button" className="btn-glow btn-ripple bg-primary text-white font-bold px-6 py-3 rounded-xl">
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab !== 'profile' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="material-symbols-outlined text-6xl text-primary/40 mb-6">construction</span>
                <h3 className="text-xl font-bold mb-2">Under Construction</h3>
                <p className="text-on-surface-variant">The {activeTab} settings page is currently being built.</p>
              </div>
            )}
          </motion.div>
        </div>

      </main>
    </div>
  );
}
