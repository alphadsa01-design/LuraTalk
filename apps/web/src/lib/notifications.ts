// LuraTalk Desktop & Background Web Notifications

class NotificationManager {
  private hasPermission: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    }

    return false;
  }

  public showIncomingCall(callerName: string, onAccept?: () => void) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted' && document.hidden) {
      const notif = new Notification(`Incoming Voice Call`, {
        body: `${callerName} is calling you on LuraTalk!`,
        icon: '/favicon.ico',
        tag: 'luratalk-call',
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        if (onAccept) onAccept();
      };
    }
  }

  public showMatchFound(partnerName: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted' && document.hidden) {
      const notif = new Notification(`Match Found!`, {
        body: `You are connected with ${partnerName}. Tap to start talking!`,
        icon: '/favicon.ico',
        tag: 'luratalk-match',
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
  }
}

export const notifications = new NotificationManager();
