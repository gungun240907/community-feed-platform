import React from 'react';
import { FileText, HelpCircle, CheckCircle2, ImageUp, GraduationCap, Code2 } from 'lucide-react';
import { useTranslation } from '../context/I18nContext';

const POST_TYPE_META = {
  post: { icon: FileText, className: 'bg-surface-100 text-surface-500 border-surface-200' },
  question: { icon: HelpCircle, className: 'bg-primary-50 text-primary-600 border-primary-200' },
  answer: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  showcase: { icon: ImageUp, className: 'bg-violet-50 text-violet-600 border-violet-200' },
  achievement: { icon: GraduationCap, className: 'bg-amber-50 text-amber-600 border-amber-200' },
  snippet: { icon: Code2, className: 'bg-surface-100 text-surface-600 border-surface-200' },
};

export default function PostTypeBadge({ type, className = '' }) {
  const { t } = useTranslation();
  const meta = POST_TYPE_META[type] || POST_TYPE_META.post;
  const Icon = meta.icon;
  if (!type || type === 'post' || type === 'answer') return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${meta.className} ${className}`}>
      <Icon size={11} />
      {t(`post.type.${type}`)}
    </span>
  );
}