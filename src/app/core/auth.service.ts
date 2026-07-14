import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { JwtPayload, LoginResponse } from './models';

const TOKEN_KEY = 'gestoreToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}auth/login`, { email, password }).pipe(
      tap((response) => localStorage.setItem(TOKEN_KEY, response.access_token)),
    );
  }

  resetManagerPassword(email: string, password: string): Observable<{ updated: boolean }> {
    return this.http.post<{ updated: boolean }>(`${environment.apiUrl}auth/manager/reset-password`, { email, password });
  }

  token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  payload(): JwtPayload | null {
    const token = this.token();
    if (!token) {
      return null;
    }

    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const payload = this.payload();
    if (!payload?.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  }

  isManager(): boolean {
    const role = this.payload()?.role;
    return role === 'gestore' || role === 'admin';
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigate(['/login']);
  }
}
