import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui';
import { onInstallAvailableChange, triggerInstall } from '@/lib/pwa';

// Renders nothing if the install isn't available (already installed, or browser
// doesn't support PWA install). Shows a small button when the browser has fired
// the deferred install prompt.
export default function InstallAppButton({ variant = 'outline', size = 'sm', label = 'Install app' }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => onInstallAvailableChange(setAvailable), []);

  if (!available) return null;

  return (
    <Button variant={variant} size={size} onClick={triggerInstall}>
      <Smartphone className="w-4 h-4" /> {label}
    </Button>
  );
}
