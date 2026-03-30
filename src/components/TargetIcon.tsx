import { Server, Monitor } from 'lucide-react';

interface TargetIconProps {
  targetId: string;
  isBuiltin?: boolean;
  isRemote?: boolean;
  className?: string;
}

export default function TargetIcon({ targetId, isBuiltin, isRemote, className = "w-4 h-4" }: TargetIconProps) {
  if (!isBuiltin) {
    if (isRemote) {
      return <Server className={className} />;
    }
    return <Monitor className={className} />;
  }

  switch (targetId) {
    case "claude-code":
      return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#F59E0B"/>
          <path d="M12 4L4 8v8l8 4 8-4V8L12 4z" fill="#D97706"/>
          <path d="M12 8l-4 2v4l4 2 4-2v-4L12 8z" fill="#1E293B"/>
          <path d="M10 11l2 1v2l-2-1v-2z" fill="#F59E0B"/>
          <path d="M14 11l-2 1v2l2-1v-2z" fill="#FBBF24"/>
        </svg>
      );
    case "codex":
      return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#0A0A0A"/>
          <path d="M16 8L8 16M8 8l8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      );
    case "gemini-cli":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#1E3A8A"/>
          <path d="M12 3l2.5 7.5L22 12l-7.5 1.5L12 21l-2.5-7.5L2 12l7.5-1.5L12 3z" fill="#60A5FA"/>
          <path d="M12 3l-2.5 7.5L2 12l7.5 1.5L12 21l2.5-7.5L22 12l-7.5-1.5z" fill="#3B82F6"/>
        </svg>
      );
    case "opencode":
      return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#0A0A0A"/>
          <path d="M8 8v8h8V8H8zM10 10h4v4h-4v-4z" fill="white"/>
        </svg>
      );
    case "cursor":
      return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#0A0A0A"/>
          <path d="M8 8l8 2-3 2-1 4-4-8z" fill="#10B981"/>
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#6B7280"/>
          <path d="M8 8l8 4-8 4V8z" fill="white"/>
        </svg>
      );
  }
}
