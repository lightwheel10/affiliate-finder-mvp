'use client';

import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import { PricingModal } from '../components/PricingModal';
import { 
  User, 
  CreditCard, 
  Bell, 
  Shield, 
  Mail, 
  Key,
  Check,
  Zap
} from 'lucide-react';

type SettingsTab = 'profile' | 'plan' | 'notifications' | 'security';

export default function SettingsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { user, updateProfile } = useAuth();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: <User size={16} />, description: 'Manage your personal information' },
    { id: 'plan', label: 'Plan & Billing', icon: <CreditCard size={16} />, description: 'Manage your subscription and billing' },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} />, description: 'Configure how you want to be notified' },
    { id: 'security', label: 'Security', icon: <Shield size={16} />, description: 'Protect your account' },
  ];

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <Sidebar isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      
      <main 
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out will-change-[margin] relative",
          isSidebarCollapsed ? "ml-[52px]" : "ml-60"
        )}
      >
        {/* Header */}
        <header className="h-14 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
           <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
            </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-8rem)]">
            
            {/* Left Panel - Navigation */}
            <div className="w-full md:w-64 shrink-0">
              <div className="sticky top-24 space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account</h3>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span className={cn(
                      "shrink-0",
                      activeTab === tab.id ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    )}>
                      {tab.icon}
                    </span>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {activeTab === tab.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Panel - Content */}
            <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-full overflow-y-auto p-6 lg:p-8">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-sm text-slate-500 mb-8">
                    {tabs.find(t => t.id === activeTab)?.description}
                  </p>

                  {activeTab === 'profile' && <ProfileSettings user={user} />}
                  {activeTab === 'plan' && (
                    <PlanSettings 
                      user={user} 
                      onUpgrade={() => setIsPricingModalOpen(true)} 
                    />
                  )}
                  {activeTab === 'notifications' && <NotificationSettings user={user} updateProfile={updateProfile} />}
                  {activeTab === 'security' && <SecuritySettings />}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
      
      <PricingModal 
        isOpen={isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)} 
      />
    </div>
  );
}

function ProfileSettings({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
        <div className="relative">
          <img 
            src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0f172a&color=fff&size=128`}
            alt="Profile" 
            className="w-20 h-20 rounded-full border-4 border-slate-50 shadow-sm"
          />
          <button className="absolute bottom-0 right-0 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 text-slate-600">
            <User size={14} />
          </button>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Profile Photo</h3>
          <p className="text-xs text-slate-500 mt-1">Update your profile picture.</p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">First Name</label>
            <input 
              type="text" 
              defaultValue={user?.name?.split(' ')[0] || ''}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Last Name</label>
            <input 
              type="text" 
              defaultValue={user?.name?.split(' ').slice(1).join(' ') || ''}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="email" 
              defaultValue={user?.email || ''}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Bio</label>
          <textarea 
            rows={4}
            defaultValue="Building the future of content generation at Jasper."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm hover:shadow">
          Save Changes
        </button>
      </div>
    </div>
  );
}

function PlanSettings({ user, onUpgrade }: { user: any, onUpgrade: () => void }) {
  const isFreeTrial = user?.plan === 'free_trial';
  const planName = isFreeTrial ? 'Free Trial' : (user?.plan || 'Pro').replace('_', ' ');
  
  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <div className={cn(
        "p-4 rounded-xl border space-y-4 transition-all",
        isFreeTrial ? "bg-slate-50 border-slate-200" : "bg-blue-50/50 border-blue-100"
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-bold", isFreeTrial ? "text-slate-900" : "text-blue-900")}>
                {planName} Plan
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                isFreeTrial ? "bg-slate-200 text-slate-600 border-slate-300" : "bg-blue-100 text-blue-700 border-blue-200"
              )}>
                Current
              </span>
            </div>
            <p className={cn("text-xs", isFreeTrial ? "text-slate-500" : "text-blue-700")}>
              {isFreeTrial ? "Trial ends in 3 days" : "Billed monthly • Next billing date: Dec 24, 2024"}
            </p>
          </div>
          {isFreeTrial ? (
            <button 
              onClick={onUpgrade}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <Zap size={14} />
              Upgrade Now
            </button>
          ) : (
            <span className="text-lg font-bold text-slate-900">$29<span className="text-sm font-normal text-slate-500">/mo</span></span>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Email Credits</span>
            <span className="font-semibold">150 / 150 used</span>
          </div>
          <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden">
            <div className={cn("h-full w-full rounded-full", isFreeTrial ? "bg-slate-400" : "bg-blue-500")} />
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-4">Payment Method</h3>
        {user?.billing?.last4 ? (
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-6 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                 <span className="text-[10px] font-bold text-slate-600 uppercase">{user.billing.brand || 'Card'}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{user.billing.brand || 'Card'} ending in {user.billing.last4}</p>
                <p className="text-xs text-slate-500">Expiry {user.billing.expiry}</p>
              </div>
            </div>
            <button className="text-xs font-semibold text-slate-500 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-all">Edit</button>
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center">
            <p className="text-sm text-slate-500 mb-2">No payment method added</p>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">Add Payment Method</button>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-4">Invoice History</h3>
        {user?.billing?.invoices && user.billing.invoices.length > 0 ? (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {user.billing.invoices.map((invoice: any) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Invoice #{invoice.id}</p>
                    <p className="text-xs text-slate-500">{invoice.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-900">{invoice.amount}</span>
                  <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">Download</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
           <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center">
             <p className="text-sm text-slate-500">No invoices yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationSettings({ user, updateProfile }: { user: any, updateProfile: (data: any) => Promise<void> }) {
  const handleToggle = async (key: string, value: boolean) => {
    await updateProfile({
      notifications: {
        ...user?.notifications,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Email Notifications</h3>
        
        {[
          { id: 'emailMatches', label: 'New affiliate matches found', desc: 'Get notified when we find new high-potential affiliates.' },
          { id: 'emailReports', label: 'Weekly performance report', desc: 'Summary of your campaign performance and outreach stats.' },
          { id: 'emailUpdates', label: 'Product updates', desc: 'News about new features and improvements.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors -mx-3">
            <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                checked={user?.notifications?.[item.id] ?? true}
                onChange={(e) => handleToggle(item.id, e.target.checked)}
                className="peer h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block cursor-pointer">{item.label}</label>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-100" />

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">App Notifications</h3>
        {[
          { id: 'appReplies', label: 'Successful outreach replies', desc: 'Notify me when an affiliate replies to my email.' },
          { id: 'appReminders', label: 'Task reminders', desc: 'Remind me about follow-ups and scheduled tasks.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors -mx-3">
             <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                checked={user?.notifications?.[item.id] ?? true}
                onChange={(e) => handleToggle(item.id, e.target.checked)}
                className="peer h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block cursor-pointer">{item.label}</label>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Password</h3>
        <div className="grid gap-4">
          <div className="space-y-1.5">
             <label className="text-xs font-semibold text-slate-700">Current Password</label>
             <input type="password" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div className="space-y-1.5">
             <label className="text-xs font-semibold text-slate-700">New Password</label>
             <input type="password" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
        </div>
        <div className="pt-2">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            Update Password
          </button>
        </div>
      </div>
      
      <div className="h-px bg-slate-100" />

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 text-red-600">Danger Zone</h3>
        <p className="text-xs text-slate-500">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 text-sm font-semibold rounded-lg hover:bg-red-100 transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  );
}

