import React, { useState } from 'react';
import { 
  Check, 
  Sparkles, 
  Gem, 
  ShieldCheck, 
  Download, 
  Radio, 
  Headphones, 
  HelpCircle,
  Zap
} from 'lucide-react';

import { UserAiCapBadge } from './UserAiCapBadge.tsx';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

interface PricingViewProps {
  currentTier?: 'Free' | 'Haven Pro';
  onSelectTier?: (tier: 'Free' | 'Haven Pro') => void;
  aiQuota?: UserAiQuotaState;
}

export const PricingView: React.FC<PricingViewProps> = ({
  currentTier = 'Haven Pro',
  onSelectTier,
  aiQuota,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleChoose = (tier: 'Free' | 'Haven Pro') => {
    if (onSelectTier) onSelectTier(tier);
    setSuccessToast(`Plan updated to ${tier}! All audiophile features active.`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-24">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 bg-[#161622] border border-[#10B981]/50 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-2">
          <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-xs font-mono-tech text-[#06B6D4]">
          <Gem className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Freemium Community & Audiophile Subscriptions</span>
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-5xl text-white">
          Support The Global AI Music Archive
        </h1>
        <p className="text-xs sm:text-base text-[#958ea0] max-w-xl mx-auto">
          AI Music Haven is free for every listener worldwide. Upgrade to Haven Pro for lossless 24-bit downloads, ad-free streaming, and expanded personal monthly AI generation caps.
        </p>
        {aiQuota && (
          <div className="pt-1 flex justify-center">
            <UserAiCapBadge quota={aiQuota} />
          </div>
        )}

        {/* Billing Switch */}
        <div className="inline-flex items-center gap-2 p-1 rounded-2xl bg-[#161622] border border-white/10 text-xs font-mono-tech mt-2">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              billingCycle === 'monthly' ? 'bg-[#8B5CF6] text-white font-semibold' : 'text-[#958ea0] hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              billingCycle === 'yearly' ? 'bg-[#8B5CF6] text-white font-semibold' : 'text-[#958ea0] hover:text-white'
            }`}
          >
            <span>Annual</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* FREE TIER */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#161622]/60 border border-white/5 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-lg text-white">Free Listener</span>
              <span className="text-xs font-mono-tech text-[#958ea0] bg-white/5 px-2 py-0.5 rounded-full">
                Standard
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-display font-extrabold text-4xl text-white">$0</span>
              <span className="text-xs text-[#958ea0]">/ forever</span>
            </div>

            <p className="text-xs text-[#958ea0] leading-relaxed">
              Complete access to discover, stream, and support the entire community archive of AI music.
            </p>

            <ul className="space-y-2.5 text-xs text-[#cbc3d7] pt-2 border-t border-white/5 font-sans">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Unlimited streaming of all 14,000+ tracks</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Standard MP3 320kbps downloads</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Access to AI Natural Language Discovery</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Create up to 10 personal playlists</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Upload up to 5 completed songs per month</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>15 personal AI story, cover &amp; mic-transcribe credits / mo</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleChoose('Free')}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono-tech border border-white/10 transition-colors"
          >
            {currentTier === 'Free' ? 'Current Plan' : 'Select Free'}
          </button>
        </div>

        {/* HAVEN PRO TIER */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#161622] via-[#161622]/90 to-[#0F0F16] border-2 border-[#8B5CF6]/50 shadow-[0_0_30px_rgba(139,92,246,0.25)] flex flex-col justify-between space-y-6">
          <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-[10px] font-mono-tech font-bold uppercase tracking-wider shadow-lg">
            Most Popular
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-lg text-white flex items-center gap-1.5">
                Haven Pro
                <Gem className="w-4 h-4 text-[#06B6D4]" />
              </span>
              <span className="text-xs font-mono-tech text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/20 px-2 py-0.5 rounded-full">
                Audiophile
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-display font-extrabold text-4xl text-white">
                {billingCycle === 'monthly' ? '$9.99' : '$7.99'}
              </span>
              <span className="text-xs text-[#958ea0]">
                {billingCycle === 'monthly' ? '/ month' : '/ mo billed annually ($95.88/yr)'}
              </span>
            </div>

            <p className="text-xs text-[#958ea0] leading-relaxed">
              Designed for serious AI music collectors, audiophiles, and creators looking for lossless preservation.
            </p>

            <ul className="space-y-2.5 text-xs text-[#cbc3d7] pt-2 border-t border-white/5 font-sans">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                <span className="font-medium text-white">100% Ad-Free uninterrupted listening</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                <span>Lossless 24-bit WAV & FLAC master downloads</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                <span>Unlimited completed track uploads with zero monthly caps</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                <span>Verified Creator checkmark profile badge</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                <span>Advanced listener geography and stream analytics</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                <span>250 personal AI story, cover &amp; mic-transcribe credits / mo</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                <span>Collaborative playlist curation permissions</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleChoose('Haven Pro')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_24px_rgba(139,92,246,0.5)] transition-all transform active:scale-95"
          >
            {currentTier === 'Haven Pro' ? 'Active Subscription' : 'Upgrade to Haven Pro'}
          </button>
        </div>
      </div>

      {/* FAQ Accordion Section */}
      <div className="space-y-4 pt-6 border-t border-white/5">
        <h3 className="font-display font-semibold text-lg text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#06B6D4]" />
          <span>Frequently Asked Questions</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#161622]/60 border border-white/5 space-y-1.5">
            <h4 className="font-semibold text-white">Does Haven Pro generate music?</h4>
            <p className="text-[#958ea0] leading-relaxed">
              No. AI Music Haven is strictly a music archive, discovery, and community platform. We never offer music generation, text-to-audio prompting, or audio remixing tools.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#161622]/60 border border-white/5 space-y-1.5">
            <h4 className="font-semibold text-white">What licenses can creators choose?</h4>
            <p className="text-[#958ea0] leading-relaxed">
              Uploaders can designate Commercial Permitted, Attribution Required (CC-BY), Free Personal Use, or All Rights Reserved for each individual song.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
