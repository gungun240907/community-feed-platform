import { Crown, Zap, Sparkles } from 'lucide-react';

const badgeConfig = {
  bronze: {
    icon: Crown,
    label: 'Bronze',
    className: 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-amber-500/30',
    size: 'w-5 h-5',
    iconSize: 12,
  },
  silver: {
    icon: Zap,
    label: 'Silver',
    className: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-slate-500/30',
    size: 'w-5 h-5',
    iconSize: 12,
  },
  gold: {
    icon: Sparkles,
    label: 'Gold',
    className: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-yellow-500/30',
    size: 'w-5 h-5',
    iconSize: 12,
  },
};

export default function ProfileBadge({ badge, size = 'sm' }) {
  if (!badge || !badgeConfig[badge]) return null;

  const config = badgeConfig[badge];
  const Icon = config.icon;

  const sizes = {
    sm: { container: 'w-5 h-5', icon: 12 },
    md: { container: 'w-6 h-6', icon: 14 },
    lg: { container: 'w-7 h-7', icon: 16 },
  };

  const dims = sizes[size] || sizes.sm;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${dims.container} ${config.className} shadow-sm`}
      title={`${config.label} Member`}
    >
      <Icon size={dims.icon} />
    </span>
  );
}