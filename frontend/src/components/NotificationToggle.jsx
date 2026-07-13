import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { toast } from 'sonner';

export function NotificationToggle({ token }) {
  const {
    isSupported,
    isSubscribed,
    loading,
    permission,
    subscribe,
    unsubscribe,
    sendTestNotification
  } = usePushNotifications(token);

  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('Notifications disabled');
      } else {
        toast.error('Failed to disable notifications');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Notifications enabled! You will receive alerts when assigned to services.');
      } else if (permission === 'denied') {
        toast.error('Notifications blocked. Please enable them in your browser settings.');
      } else {
        toast.error('Failed to enable notifications');
      }
    }
  };

  const handleTest = async () => {
    const success = await sendTestNotification();
    if (success) {
      toast.success('Test notification sent!');
    } else {
      toast.error('Failed to send test notification');
    }
  };

  if (loading) {
    return (
      <Button disabled variant="ghost" size="icon" className="relative">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={handleToggle}
        variant="ghost"
        size="icon"
        className={`relative ${isSubscribed ? 'text-amber-500' : 'text-gray-400'}`}
        title={isSubscribed ? 'Disable notifications' : 'Enable notifications'}
      >
        {isSubscribed ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
        {isSubscribed && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
        )}
      </Button>
      {isSubscribed && (
        <Button
          onClick={handleTest}
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-amber-500"
          title="Send test notification"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
