import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClientInviteDetails, ClientInvitePhoneOtpResponse, JwtPayload, LoginResponse, ManagerPasswordResetLinkResponse, ManagerRegistrationConfirmResponse, ManagerRegistrationOtpResponse } from './models';
import { UserRole } from './user-role.enum';

const TOKEN_KEY = 'gestoreToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loginCompletedSubject = new Subject<void>();
  loginCompleted$ = this.loginCompletedSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}auth/login`, { email, password }).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.access_token);
        this.loginCompletedSubject.next();
      }),
    );
  }

  resetManagerPassword(email: string, password: string): Observable<{ updated: boolean }> {
    return this.http.post<{ updated: boolean }>(`${environment.apiUrl}auth/manager/reset-password`, { email, password });
  }

  requestManagerPasswordResetLink(email: string): Observable<ManagerPasswordResetLinkResponse> {
    return this.http.post<ManagerPasswordResetLinkResponse>(`${environment.apiUrl}auth/manager/password-reset/request-link`, { email });
  }

  confirmManagerPasswordReset(token: string, password: string): Observable<{ updated: boolean; email: string }> {
    return this.http.post<{ updated: boolean; email: string }>(`${environment.apiUrl}auth/manager/password-reset/confirm`, { token, password });
  }

  requestManagerRegistrationOtp(payload: {
    name: string;
    email: string;
    phone: string;
    taxCode: string;
    password: string;
  }): Observable<ManagerRegistrationOtpResponse> {
    return this.http.post<ManagerRegistrationOtpResponse>(`${environment.apiUrl}auth/manager/register/request-otp`, payload);
  }

  confirmManagerRegistrationOtp(email: string, emailOtp: string, phoneOtp: string): Observable<ManagerRegistrationConfirmResponse> {
    return this.http.post<ManagerRegistrationConfirmResponse>(`${environment.apiUrl}auth/manager/register/confirm-otp`, { email, emailOtp, phoneOtp });
  }

  getClientInviteDetails(token: string): Observable<ClientInviteDetails> {
    return this.http.get<ClientInviteDetails>(`${environment.apiUrl}auth/client/complete-registration?token=${encodeURIComponent(token)}`);
  }

  requestClientInvitePhoneOtp(token: string, phone: string): Observable<ClientInvitePhoneOtpResponse> {
    return this.http.post<ClientInvitePhoneOtpResponse>(`${environment.apiUrl}auth/client/complete-registration/request-phone-otp`, { token, phone });
  }

  completeClientRegistration(payload: {
    token: string;
    name: string;
    email: string;
    phone?: string;
    taxCode?: string;
    password: string;
    acceptedDataProcessing: boolean;
    phoneOtp?: string;
  }): Observable<{ completed: boolean }> {
    return this.http.post<{ completed: boolean }>(`${environment.apiUrl}auth/client/complete-registration`, payload);
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
    return role === UserRole.Gestore || role === UserRole.Admin;
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigate(['/login']);
  }
}
