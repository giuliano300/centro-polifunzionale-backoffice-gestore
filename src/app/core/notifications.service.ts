import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  isRead: boolean;
  createdAt?: string | Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private socket?: Socket;
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  private unreadSubject = new BehaviorSubject<number>(0);
  notifications$ = this.notificationsSubject.asObservable();
  unread$ = this.unreadSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  connect(): void {
    const token = this.auth.token();
    if (!token || this.socket?.connected) {
      return;
    }

    this.load();
    this.socket = io(environment.apiUrl.replace(/\/$/, ''), {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('notification', (notification: AppNotification) => {
      const current = this.notificationsSubject.value;
      this.notificationsSubject.next(this.sortRecentFirst([notification, ...current]).slice(0, 30));
      this.unreadSubject.next(this.unreadSubject.value + 1);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.notificationsSubject.next([]);
    this.unreadSubject.next(0);
  }

  load(): void {
    const token = this.auth.token();
    if (!token) {
      return;
    }

    this.http.get<AppNotification[]>(`${environment.apiUrl}notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe((items) => {
      this.notificationsSubject.next(this.sortRecentFirst(items));
      this.unreadSubject.next(items.filter((item) => !item.isRead).length);
    });
  }

  markAllRead(): void {
    const token = this.auth.token();
    if (!token) {
      return;
    }

    const updated = this.notificationsSubject.value.map((item) => ({ ...item, isRead: true }));
    this.notificationsSubject.next(updated);
    this.unreadSubject.next(0);

    this.http.patch(`${environment.apiUrl}notifications/read-all`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: () => this.load(),
      error: () => this.load(),
    });
  }

  private sortRecentFirst(items: AppNotification[]): AppNotification[] {
    return [...items].sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }
}
