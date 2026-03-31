import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-1">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
