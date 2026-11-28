/**
 * API Client for GreenHarvest Solutions
 * Handles all HTTP requests to the backend API
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
};

class APIClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: getApiBaseUrl(),
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const token = this.getToken();
          if (token && this.isTokenExpiringSoon(token, 120)) {
            void this.refreshAccessToken();
          }
        }
      });
    }

    // Request interceptor to add auth token, proactively refresh expiring JWTs, and adapt baseURL to client host
    this.client.interceptors.request.use(
      async (config) => {
        if (typeof window !== 'undefined') {
          const currentHost = window.location.hostname;
          if (config.baseURL && (config.baseURL.includes('localhost') || config.baseURL.includes('127.0.0.1'))) {
            config.baseURL = `${window.location.protocol}//${currentHost}:5000/api`;
          }
        }

        const url = config.url || '';
        const isAuthEndpoint =
          url.includes('/auth/login') ||
          url.includes('/auth/register') ||
          url.includes('/auth/refresh') ||
          url.includes('/auth/forgot-password') ||
          url.includes('/auth/reset-password');

        let token = this.getToken();
        if (token && !isAuthEndpoint && this.isTokenExpiringSoon(token, 90)) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) token = refreshed;
        }

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: seamlessly refresh expired access tokens once before redirecting
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
        const url = originalRequest?.url || '';
        const isAuthEndpoint =
          url.includes('/auth/login') ||
          url.includes('/auth/register') ||
          url.includes('/auth/refresh') ||
          url.includes('/auth/forgot-password') ||
          url.includes('/auth/reset-password') ||
          url.includes('/auth/logout');

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;
          const newToken = await this.refreshAccessToken();
          if (newToken) {
            originalRequest.headers = {
              ...(originalRequest.headers || {}),
              Authorization: `Bearer ${newToken}`,
            };
            return this.client.request(originalRequest);
          }
        }

        if (error.response?.status === 401 && !isAuthEndpoint) {
          // Refresh failed or session revoked
          this.clearToken();
          if (
            typeof window !== 'undefined' &&
            !window.location.pathname.startsWith('/admin') &&
            window.location.pathname !== '/login' &&
            window.location.pathname !== '/register' &&
            window.location.pathname !== '/verify-email'
          ) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private decodeJwtExp(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  private isTokenExpiringSoon(token: string, thresholdSeconds = 90): boolean {
    const exp = this.decodeJwtExp(token);
    if (!exp) return false;
    return exp - Math.floor(Date.now() / 1000) <= thresholdSeconds;
  }

  async ensureFreshToken(): Promise<string | null> {
    const token = this.getToken();
    if (!token) return null;
    if (this.isTokenExpiringSoon(token, 90)) {
      const refreshed = await this.refreshAccessToken();
      return refreshed || this.getToken();
    }
    return token;
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const storedRefreshToken =
          typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        const response = await axios.post<{
          access_token: string;
          refresh_token?: string;
          user?: any;
        }>(
          `${getApiBaseUrl()}/auth/refresh`,
          storedRefreshToken ? { refresh_token: storedRefreshToken } : {},
          {
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const nextAccessToken = response.data?.access_token;
        if (nextAccessToken) {
          this.setToken(nextAccessToken);
          if (typeof window !== 'undefined') {
            if (response.data.refresh_token) {
              localStorage.setItem('refreshToken', response.data.refresh_token);
            }
            if (response.data.user) {
              localStorage.setItem('user', JSON.stringify(response.data.user));
            }
          }
          return nextAccessToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken') || localStorage.getItem('token');
    }
    return null;
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('token', token);
    }
  }

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('gh_keep_logged_in');
    }
  }

  // Generic request method
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.request(config);
    return response.data;
  }

  // Auth endpoints
  async login(email: string, password: string, rememberMe = true) {
    const response = await this.request<{ access_token: string; refresh_token?: string; user: any }>({
      method: 'POST',
      url: '/auth/login',
      data: { email, password, remember_me: rememberMe },
    });
    // Backend returns snake_case: access_token
    this.setToken(response.access_token);
    if (typeof window !== 'undefined') {
      if (response.refresh_token) {
        localStorage.setItem('refreshToken', response.refresh_token);
      }
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      localStorage.setItem('gh_keep_logged_in', rememberMe ? 'true' : 'false');
      if (rememberMe) {
        localStorage.setItem('gh_remember_email', email.trim());
      } else {
        localStorage.removeItem('gh_remember_email');
      }
    }
    return response;
  }

  async getOAuthProviders() {
    return this.request<{
      providers: Array<{ id: string; name: string; configured: boolean; env_keys?: string[] }>;
    }>({
      method: 'GET',
      url: '/auth/oauth/providers',
    });
  }

  getOAuthStartUrl(
    provider: 'google' | 'facebook' | 'github',
    options?: { role?: string; rememberMe?: boolean }
  ): string {
    const baseUrl = getApiBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams();
    if (options?.role) params.set('role', options.role);
    if (options?.rememberMe !== undefined) {
      params.set('remember_me', options.rememberMe ? 'true' : 'false');
    }
    if (typeof window !== 'undefined') {
      params.set('frontend_origin', window.location.origin);
    }
    return `${baseUrl}/auth/oauth/${provider}?${params.toString()}`;
  }

  async exchangeOAuthCode(code: string) {
    const response = await this.request<{
      access_token: string;
      refresh_token?: string;
      user: any;
      remember_me?: boolean;
    }>({
      method: 'POST',
      url: '/auth/oauth/exchange',
      data: { code },
    });

    this.setToken(response.access_token);
    if (typeof window !== 'undefined') {
      if (response.refresh_token) {
        localStorage.setItem('refreshToken', response.refresh_token);
      }
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        if (response.remember_me && response.user.email) {
          localStorage.setItem('gh_remember_email', response.user.email);
        }
      }
      localStorage.setItem('gh_keep_logged_in', response.remember_me ? 'true' : 'false');
    }
    return response;
  }

  async verifyEmail(token: string) {
    return this.request({
      method: 'GET',
      url: `/auth/verify-email?token=${token}`,
    });
  }

  async register(userData: any) {
    return this.request({
      method: 'POST',
      url: '/auth/register',
      data: userData,
    });
  }

  async logout() {
    try {
      await this.request({
        method: 'POST',
        url: '/auth/logout',
      });
    } catch {
      // Ignore network / auth errors during logout
    } finally {
      this.clearToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }

  async forgotPassword(email: string) {
    return this.request({
      method: 'POST',
      url: '/auth/forgot-password',
      data: { email },
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request({
      method: 'POST',
      url: '/auth/reset-password',
      data: { token, password },
    });
  }

  // Upload endpoints
  async uploadProductImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return this.request<{ url: string; public_id: string }>({
      method: 'POST',
      url: '/upload/product-image',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async uploadProductImages(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    return this.request<{ images: { url: string; public_id: string }[]; urls: string[] }>({
      method: 'POST',
      url: '/upload/product-images',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async deleteProductImage(public_id: string) {
    return this.request<{ message: string }>({
      method: 'DELETE',
      url: '/upload/product-image',
      data: { public_id },
    });
  }

  // Product endpoints
  async getProducts(filters?: any) {
    return this.request<{ products: any[] }>({
      method: 'GET',
      url: '/products',
      params: filters,
    });
  }

  async getProductById(id: string) {
    return this.request<{ product: any }>({
      method: 'GET',
      url: `/products/${id}`,
    });
  }

  async createProduct(productData: any) {
    return this.request({
      method: 'POST',
      url: '/products',
      data: productData,
    });
  }

  async updateProduct(id: string, productData: any) {
    return this.request({
      method: 'PUT',
      url: `/products/${id}`,
      data: productData,
    });
  }

  async deleteProduct(id: string | number) {
    return this.request({
      method: 'DELETE',
      url: `/products/${id}`,
    });
  }

  async updateProductStatus(id: string | number, status: 'active' | 'draft' | 'deactivated') {
    return this.request<{ product: any; message: string }>({
      method: 'PATCH',
      url: `/products/${id}/status`,
      data: { status },
    });
  }

  async batchUpdateProductsStatus(product_ids: (string | number)[], status: 'active' | 'draft' | 'deactivated') {
    return this.request<{ message: string; affected: number }>({
      method: 'PATCH',
      url: '/products/batch',
      data: { product_ids, status },
    });
  }

  // Cart endpoints
  async getCart() {
    return this.request<{ cart: any[] }>({
      method: 'GET',
      url: '/cart',
    });
  }

  async addToCart(productId: string, quantity: number) {
    return this.request({
      method: 'POST',
      url: '/cart',
      data: { productId, quantity },
    });
  }

  async updateCartItem(id: string, quantity: number) {
    return this.request({
      method: 'PATCH',
      url: `/cart/${id}`,
      data: { quantity },
    });
  }

  async removeFromCart(id: string) {
    return this.request({
      method: 'DELETE',
      url: `/cart/${id}`,
    });
  }

  async clearCart() {
    return this.request({
      method: 'DELETE',
      url: '/cart/clear',
    });
  }

  // Order endpoints
  async getOrders() {
    return this.request<{ orders: any[] }>({
      method: 'GET',
      url: '/orders',
    });
  }

  async getOrderById(id: string) {
    return this.request<{ order: any }>({
      method: 'GET',
      url: `/orders/${id}`,
    });
  }

  async createOrder(orderData: any): Promise<any> {
    return this.request<any>({
      method: 'POST',
      url: '/orders',
      data: orderData,
    });
  }

  async updateOrderStatus(id: string, status: string) {
    return this.request({
      method: 'PATCH',
      url: `/orders/${id}/status`,
      data: { status },
    });
  }

  // Payment endpoints (Chapa)
  async initializeChapaPayment(order_id: string, return_url: string) {
    return this.request<{ checkout_url: string; tx_ref: string; message: string }>({
      method: 'POST',
      url: '/payments/chapa/initialize',
      data: { order_id, return_url },
    });
  }

  async verifyChapaPayment(tx_ref: string, order_id: string) {
    return this.request<{ status: string; message: string }>({
      method: 'POST',
      url: '/payments/chapa/verify',
      data: { tx_ref, order_id },
    });
  }

  async initiatePayment(data: { order_id: string | number; payment_method: string; return_url?: string }) {
    return this.request<{ checkout_url: string; transaction_id: string; provider: string; message: string }>({
      method: 'POST',
      url: '/payments/initiate',
      data,
    });
  }

  async verifyPayment(data: { order_id: string | number; provider?: string; reference?: string; tx_ref?: string }) {
    return this.request<{ status: string; payment_status?: string; message: string }>({
      method: 'POST',
      url: '/payments/verify',
      data,
    });
  }

  // Phase 5 Fulfillment Endpoints
  async markSuborderReadyForPickup(suborderId: string | number, data?: { pickup_location?: string; farmer_notes?: string }) {
    return this.request<{ message: string; suborder_id: number; pickup_code: string }>({
      method: 'POST',
      url: `/deliveries/suborders/${suborderId}/ready-pickup`,
      data: data || {},
    });
  }

  async confirmSuborderPickup(suborderId: string | number, pickup_code: string) {
    return this.request<{ message: string; suborder_id: number; fulfillment_status: string }>({
      method: 'POST',
      url: `/deliveries/suborders/${suborderId}/confirm-pickup`,
      data: { pickup_code },
    });
  }

  async dispatchFarmerDelivery(suborderId: string | number, data: { estimated_time?: string; vehicle_info?: string; farmer_notes?: string }) {
    return this.request<{ message: string; suborder_id: number; delivery_confirmation_code: string }>({
      method: 'POST',
      url: `/deliveries/suborders/${suborderId}/dispatch-farmer`,
      data,
    });
  }

  async confirmFarmerDelivery(suborderId: string | number, confirmation_code?: string) {
    return this.request<{ message: string; suborder_id: number; fulfillment_status: string }>({
      method: 'POST',
      url: `/deliveries/suborders/${suborderId}/confirm-delivery`,
      data: { confirmation_code },
    });
  }

  async getDeliveryPool() {
    return this.request<{ pool: any[]; count: number }>({
      method: 'GET',
      url: '/deliveries/pool',
    });
  }

  async claimPoolDelivery(suborderId: string | number, data?: { estimated_time?: string }) {
    return this.request<{ message: string; suborder_id: number; claimed_by: number }>({
      method: 'POST',
      url: `/deliveries/pool/${suborderId}/claim`,
      data: data || {},
    });
  }

  async updatePartnerTransitStatus(
    suborderId: string | number,
    data: {
      status: string;
      proof_of_delivery_image_url?: string;
      notes?: string;
      confirmation_code?: string;
      pickup_code?: string;
    }
  ) {
    return this.request<{ message: string; suborder_id: number; status: string; requeued?: boolean }>({
      method: 'PATCH',
      url: `/deliveries/suborders/${suborderId}/partner-status`,
      data,
    });
  }

  async estimateCheckoutDelivery(data: {
    delivery_address?: string;
    destination_lat?: number | null;
    destination_lng?: number | null;
    fulfillment_selections?: Record<string, string>;
    branch_selections?: Record<string, number>;
    allocation_strategy?: string;
    allow_split?: boolean;
    enable_consolidation?: boolean;
    is_same_day?: boolean;
    create_quotes?: boolean;
  }) {
    return this.request<{
      destination_address: string;
      detected_zone?: any;
      total_shipping_fee: number;
      original_shipping_fee?: number;
      consolidation?: {
        consolidation_eligible: boolean;
        estimated_savings: number;
        groups: any[];
        food_safety_rule?: string;
      };
      quotes?: Record<string, any>;
      packages: Record<string, any>;
    }>({
      method: 'POST',
      url: '/deliveries/estimate',
      data,
    });
  }

  // Multi-Branch Business, Branches, Staff & Inventory Transfers
  async getMyBranches() {
    return this.request<{ business: any; branches: any[]; access_mode: string }>({
      method: 'GET',
      url: '/branches/my',
    });
  }

  async updateMyBusiness(data: any) {
    return this.request<{ business: any }>({
      method: 'PUT',
      url: '/branches/business/me',
      data,
    });
  }

  async createBranch(data: any) {
    return this.request<{ branch: any }>({
      method: 'POST',
      url: '/branches',
      data,
    });
  }

  async getBranchDetails(branchId: number | string) {
    return this.request<{ branch: any; staff: any[]; service_areas: any[]; verification_history: any[]; audit_logs: any[] }>({
      method: 'GET',
      url: `/branches/${branchId}`,
    });
  }

  async updateBranch(branchId: number | string, data: any) {
    return this.request<{ branch: any }>({
      method: 'PUT',
      url: `/branches/${branchId}`,
      data,
    });
  }

  async submitBranchVerification(branchId: number | string, notes?: string) {
    return this.request<{ branch: any }>({
      method: 'POST',
      url: `/branches/${branchId}/submit-verification`,
      data: { notes },
    });
  }

  async updateBranchOperationalStatus(branchId: number | string, operational_status: string, closure_reason?: string) {
    return this.request<{ branch: any; impacted_exceptions: any[] }>({
      method: 'PATCH',
      url: `/branches/${branchId}/operational-status`,
      data: { operational_status, closure_reason },
    });
  }

  async assignBranchStaff(branchId: number | string, data: any) {
    return this.request<{ staff: any }>({
      method: 'POST',
      url: `/branches/${branchId}/staff`,
      data,
    });
  }

  async removeBranchStaff(branchId: number | string, staffId: number | string) {
    return this.request<{ removed: any }>({
      method: 'DELETE',
      url: `/branches/${branchId}/staff/${staffId}`,
    });
  }

  async getBranchInventory(branchId: number | string) {
    return this.request<{ branch_id: number; items: any[] }>({
      method: 'GET',
      url: `/inventory/branches/${branchId}`,
    });
  }

  async upsertBranchInventory(branchId: number | string, data: any) {
    return this.request<{ item: any }>({
      method: 'PUT',
      url: `/inventory/branches/${branchId}`,
      data,
    });
  }

  async adjustBranchInventory(branchId: number | string, data: { product_id: number; quantity: number; adjustment_type: string; reason?: string }) {
    return this.request<{ item: any }>({
      method: 'POST',
      url: `/inventory/branches/${branchId}/adjust`,
      data,
    });
  }

  async getBranchMovements(branchId: number | string) {
    return this.request<{ movements: any[] }>({
      method: 'GET',
      url: `/inventory/branches/${branchId}/movements`,
    });
  }

  async listTransfers() {
    return this.request<{ transfers: any[] }>({
      method: 'GET',
      url: '/inventory/transfers',
    });
  }

  async createTransfer(data: { source_branch_id: number; destination_branch_id: number; notes?: string; items: { product_id: number; quantity: number }[] }) {
    return this.request<{ transfer: any }>({
      method: 'POST',
      url: '/inventory/transfers',
      data,
    });
  }

  async transitionTransfer(transferId: number | string, data: { action: string; items?: any[]; delay_reason?: string; discrepancy_notes?: string }) {
    return this.request<{ transfer: any }>({
      method: 'POST',
      url: `/inventory/transfers/${transferId}/action`,
      data,
    });
  }

  // Buyer Saved Ethiopian Addresses
  async getAddresses() {
    return this.request<{ addresses: any[] }>({
      method: 'GET',
      url: '/addresses',
    });
  }

  async createAddress(data: any) {
    return this.request<{ address: any; detected_zone: any }>({
      method: 'POST',
      url: '/addresses',
      data,
    });
  }

  async deleteAddress(addressId: number | string) {
    return this.request<{ deleted: boolean }>({
      method: 'DELETE',
      url: `/addresses/${addressId}`,
    });
  }

  // Quotes, Zones, Pricing Rules, SLA & Reconciliation
  async getDeliveryZones(includeInactive = false) {
    return this.request<{ zones: any[] }>({
      method: 'GET',
      url: '/branches/zones',
      params: { include_inactive: includeInactive ? 'true' : undefined },
    });
  }

  async upsertDeliveryZone(data: any) {
    return this.request<{ zone: any }>({
      method: 'POST',
      url: '/branches/zones',
      data,
    });
  }

  async adminListBranches(params?: { verification_status?: string; search?: string }) {
    return this.request<{ branches: any[]; pagination: any }>({
      method: 'GET',
      url: '/branches/admin/all',
      params,
    });
  }

  async adminVerifyBranch(branchId: number | string, data: { verification_status: string; decision_notes?: string }) {
    return this.request<{ branch: any; impacted_exceptions_created: number }>({
      method: 'PATCH',
      url: `/branches/admin/${branchId}/verify`,
      data,
    });
  }

  async adminGetPricingRules() {
    return this.request<{ rules: any[] }>({
      method: 'GET',
      url: '/logistics-ops/admin/pricing-rules',
    });
  }

  async adminCreatePricingRule(data: any) {
    return this.request<{ rule: any }>({
      method: 'POST',
      url: '/logistics-ops/admin/pricing-rules',
      data,
    });
  }

  async adminGetAllocationStrategy() {
    return this.request<{ value: string; allowed: string[] }>({
      method: 'GET',
      url: '/logistics-ops/admin/allocation-strategy',
    });
  }

  async adminSetAllocationStrategy(strategy: string) {
    return this.request<{ value: string; allowed: string[] }>({
      method: 'PUT',
      url: '/logistics-ops/admin/allocation-strategy',
      data: { strategy },
    });
  }

  async adminListExceptions() {
    return this.request<{ exceptions: any[] }>({
      method: 'GET',
      url: '/logistics-ops/admin/exceptions',
    });
  }

  async adminScanSla() {
    return this.request<{ scanned_overdue_count: number; exceptions: any[] }>({
      method: 'POST',
      url: '/logistics-ops/admin/sla/scan',
    });
  }

  async getFinancialReconciliation() {
    return this.request<{ branch_financial_summary: any[]; parent_order_reconciliation: any[]; driver_compensation_summary: any }>({
      method: 'GET',
      url: '/logistics-ops/financial-reconciliation',
    });
  }

  async getOrderCommunications(orderId: number | string) {
    return this.request<{ messages: any[] }>({
      method: 'GET',
      url: `/logistics-ops/orders/${orderId}/messages`,
    });
  }

  async postOrderCommunication(orderId: number | string, data: { suborder_id?: number; channel?: string; message: string }) {
    return this.request<{ message: any }>({
      method: 'POST',
      url: `/logistics-ops/orders/${orderId}/messages`,
      data,
    });
  }

  async getMyPartnerProfile() {
    return this.request<{ profile: any }>({
      method: 'GET',
      url: '/deliveries/partner/profile',
    });
  }

  async submitMyPartnerProfile(data: {
    vehicle_type: string;
    vehicle_plate: string;
    vehicle_capacity_kg?: number;
    license_number: string;
    national_id_number: string;
    operating_region: string;
    id_document_url?: string;
    license_document_url?: string;
  }) {
    return this.request<{ message: string; profile: any }>({
      method: 'PUT',
      url: '/deliveries/partner/profile',
      data,
    });
  }

  async postDeliveryCheckpoint(
    suborderId: string | number,
    data: {
      location_name: string;
      latitude?: number;
      longitude?: number;
      estimated_time?: string;
      notes?: string;
    }
  ) {
    return this.request<{ message: string; current_checkpoint: string; event: any }>({
      method: 'POST',
      url: `/deliveries/suborders/${suborderId}/checkpoint`,
      data,
    });
  }

  async rateSuborderDelivery(
    suborderId: string | number,
    data: { rating: number; feedback?: string }
  ) {
    return this.request<{ message: string; rating: number }>({
      method: 'POST',
      url: `/deliveries/suborders/${suborderId}/rate`,
      data,
    });
  }

  async getAdminDeliveryPartners(params?: { status?: string; search?: string }) {
    return this.request<{ partners: any[] }>({
      method: 'GET',
      url: '/admin/logistics/partners',
      params,
    });
  }

  async verifyAdminDeliveryPartner(
    userId: string | number,
    data: { status: 'verified' | 'suspended' | 'pending_review' | 'unverified'; notes?: string }
  ) {
    return this.request<{ message: string; profile: any }>({
      method: 'PATCH',
      url: `/admin/logistics/partners/${userId}/verify`,
      data,
    });
  }

  async getSuborderDelivery(suborderId: string | number) {
    return this.request<{ delivery: any }>({
      method: 'GET',
      url: `/deliveries/suborders/${suborderId}`,
    });
  }

  async getAssignedDeliveries() {
    return this.request<{ deliveries: any[] }>({
      method: 'GET',
      url: '/deliveries/assigned',
    });
  }

  async trackOrderDeliveries(orderId: string | number) {
    return this.request<{ deliveries: any[]; delivery: any }>({
      method: 'GET',
      url: `/deliveries/track/${orderId}`,
    });
  }

  // Category endpoints
  async getCategories() {
    return this.request<{ categories: any[] }>({
      method: 'GET',
      url: '/categories',
    });
  }

  async getCategoryById(id: string) {
    return this.request<{ category: any }>({
      method: 'GET',
      url: `/categories/${id}`,
    });
  }

  // User endpoints
  async getUserProfile() {
    return this.request<{ user: any }>({
      method: 'GET',
      url: '/users/me',
    });
  }

  async updateUserProfile(userData: any) {
    return this.request({
      method: 'PUT',
      url: '/users/me',
      data: userData,
    });
  }

  async getFarmerProfile(farmerId: string) {
    return this.request<{ user: any }>({
      method: 'GET',
      url: `/users/farmer/${farmerId}`,
    });
  }

  async getFarmerProfileProgress() {
    return this.request<{
      score: number;
      sections: {
        personal: boolean;
        farm_info: boolean;
        location: boolean;
        crops: boolean;
        payout: boolean;
      };
      profile: any;
    }>({
      method: 'GET',
      url: '/users/farmer/profile-progress',
    });
  }

  async updateFarmerProfileExtended(data: any) {
    return this.request<{
      message: string;
      score: number;
      sections: any;
      profile: any;
    }>({
      method: 'PUT',
      url: '/users/farmer/profile-extended',
      data,
    });
  }

  async getFarmerKycStatus() {
    return this.request<{
      farmer_id: number;
      name: string;
      email: string;
      kyc_status: string;
      kyc_tier: string;
      is_verified: boolean;
      email_verified: boolean;
      documents: any[];
      latest_review: any;
      allowed_actions: string[];
    }>({
      method: 'GET',
      url: '/farmer/kyc',
    });
  }

  async uploadFarmerKycDocument(data: any) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return this.request<{
      message: string;
      document: any;
    }>({
      method: 'POST',
      url: '/farmer/kyc/documents',
      data,
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
  }

  async deleteFarmerKycDocument(documentId: number | string) {
    return this.request<{
      message: string;
      document: any;
    }>({
      method: 'DELETE',
      url: `/farmer/kyc/documents/${documentId}`,
    });
  }

  async submitFarmerKyc() {
    return this.request<{
      success: boolean;
      kyc_status: string;
      message: string;
    }>({
      method: 'POST',
      url: '/farmer/kyc/submit',
    });
  }

  async getStoreLayoutByFarmerId(farmerId: string) {
    return this.request<{ layout: any }>({
      method: 'GET',
      url: `/store-layout/${farmerId}`,
    });
  }

  // Review endpoints
  async getProductReviews(productId: string) {
    return this.request<{ reviews: any[] }>({
      method: 'GET',
      url: `/reviews/product/${productId}`,
    });
  }

  async createReview(reviewData: any) {
    return this.request({
      method: 'POST',
      url: '/reviews',
      data: reviewData,
    });
  }

  // Notification endpoints
  async getNotifications() {
    return this.request<{ notifications: any[] }>({
      method: 'GET',
      url: '/notifications',
    });
  }

  async markNotificationAsRead(id: string) {
    return this.request({
      method: 'PATCH',
      url: `/notifications/${id}`,
    });
  }

  // Farmer Dashboard endpoints
  async getFarmerDashboard() {
    return this.request<any>({
      method: 'GET',
      url: '/dashboard/farmer',
    });
  }

  async getFarmerOrders(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    return this.request<{ orders: any[]; pagination: any }>({
      method: 'GET',
      url: '/dashboard/farmer/orders',
      params,
    });
  }

  async getFarmerProducts(params?: { page?: number; limit?: number; search?: string; category?: string; stock_status?: string }) {
    return this.request<{ products: any[]; pagination: any }>({
      method: 'GET',
      url: '/dashboard/farmer/products',
      params,
    });
  }

  async submitProductForModeration(productId: string | number) {
    return this.request<{ message: string; product: any; evaluation: any }>({
      method: 'POST',
      url: `/products/${productId}/submit`,
    });
  }

  async getProductRevisions(productId: string | number) {
    return this.request<{ revisions: any[] }>({
      method: 'GET',
      url: `/products/${productId}/revisions`,
    });
  }

  async reviewProductRevision(revisionId: string | number, data: { decision: 'approve' | 'reject'; feedback?: string }) {
    return this.request<{ message: string; result: any }>({
      method: 'POST',
      url: `/admin/products/revisions/${revisionId}/review`,
      data,
    });
  }

  async exportFarmerOrdersCSV(params?: { status?: string; search?: string }) {
    const token = await this.ensureFreshToken();
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.search) queryParams.set('search', params.search);
    const url = `${getApiBaseUrl()}/dashboard/farmer/orders/export-csv?${queryParams.toString()}`;
    const response = await fetch(url, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async exportFarmerProductsCSV() {
    const token = await this.ensureFreshToken();
    const url = `${getApiBaseUrl()}/dashboard/farmer/products/export-csv`;
    const response = await fetch(url, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `products-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async batchUpdateProducts(product_ids: string[], action: 'delete' | 'deactivate' | 'reactivate') {
    return this.request<{ message: string; affected: number; product_ids: number[] }>({
      method: 'POST',
      url: '/dashboard/farmer/products/batch',
      data: { product_ids: product_ids.map(Number), action },
    });
  }

  async updateReturnStatus(orderId: string, action: 'approve' | 'reject' | 'refund', rejection_reason?: string) {
    return this.request<{ message: string; order_id: number; new_status: string }>({
      method: 'PATCH',
      url: `/dashboard/farmer/orders/${orderId}/return`,
      data: { action, rejection_reason },
    });
  }

  async updateFarmerSuborderStatus(suborderId: string | number, status: string) {
    return this.request<{ message: string; suborder: any }>({
      method: 'PATCH',
      url: `/dashboard/farmer/suborders/${suborderId}/status`,
      data: { status },
    });
  }

  // Task 5.1 — Returns endpoints
  async getReturns(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    return this.request<{ returns: any[]; pagination: any }>({
      method: 'GET',
      url: '/returns',
      params,
    });
  }

  // Task 5.2 — Create return
  async createReturn(data: { order_id: number; reason: string; restock_quantity?: number }) {
    return this.request<{ return: any }>({
      method: 'POST',
      url: '/returns',
      data,
    });
  }

  // Task 5.3 — Update return (accept/reject)
  async updateReturn(
    id: string | number,
    action: 'accept' | 'reject',
    data?: { resolution_note?: string; restock?: boolean }
  ) {
    return this.request<{ return: any }>({
      method: 'PATCH',
      url: `/returns/${id}`,
      data: { action, ...data },
    });
  }

  // Task 5.4 — Batch update product status
  async batchUpdateProductStatus(product_ids: string[], status: 'active' | 'draft' | 'deactivated') {
    return this.request<{ message: string; affected: number; product_ids: number[] }>({
      method: 'PATCH',
      url: '/products/batch',
      data: { product_ids: product_ids.map(Number), status },
    });
  }

  async updateProductStock(id: string, stock: number) {
    return this.request({
      method: 'PATCH',
      url: `/products/${id}/stock`,
      data: { stock },
    });
  }

  // Campaign endpoints
  async getCampaigns() {
    return this.request<{ campaigns: any[] }>({
      method: 'GET',
      url: '/campaigns',
    });
  }

  async getCampaignStats() {
    return this.request<{ stats: any }>({
      method: 'GET',
      url: '/campaigns/stats',
    });
  }

  async createCampaign(campaignData: any) {
    return this.request({
      method: 'POST',
      url: '/campaigns',
      data: campaignData,
    });
  }

  async updateCampaign(id: string, campaignData: any) {
    return this.request({
      method: 'PUT',
      url: `/campaigns/${id}`,
      data: campaignData,
    });
  }

  async updateCampaignStatus(id: string, status: string) {
    return this.request({
      method: 'PATCH',
      url: `/campaigns/${id}/status`,
      data: { status },
    });
  }

  async deleteCampaign(id: string) {
    return this.request({
      method: 'DELETE',
      url: `/campaigns/${id}`,
    });
  }

  // Store Decoration endpoints
  async getStoreLayout() {
    return this.request<{ layout: any }>({
      method: 'GET',
      url: '/store-layout',
    });
  }

  async updateStoreLayout(layoutData: any) {
    return this.request<{ message: string; layout: any }>({
      method: 'PUT',
      url: '/store-layout',
      data: layoutData,
    });
  }

  // Business Advisor
  async getAdvisorDashboard(region?: string) {
    return this.request<any>({
      method: 'GET',
      url: '/advisor',
      params: region ? { region } : undefined,
    });
  }

  // Market Insights
  async getMarketInsights(months = 6) {
    return this.request<{ data: any }>({
      method: 'GET',
      url: '/market-insights',
      params: { months },
    });
  }

  // Admin endpoints
  async getAdminDashboard() {
    return this.request<{
      metrics: {
        total_users: number;
        total_farmers: number;
        total_orders: number;
        total_revenue: number | string;
        active_today?: number;
        fulfillment_rate?: number;
        active_fleet_trucks?: number;
        cold_chain_compliance?: number;
        avg_speed_kmh?: number;
        kyc_pending_count?: number;
        moderation_pending_count?: number;
        disputes_open_count?: number;
        fleet_breaches_count?: number;
        regional_analytics?: any[];
        top_selling_products: Array<{
          id: number | string;
          name: string;
          units_sold: number;
          revenue_generated: number | string;
        }>;
        pending_farmers?: Array<{
          id: number | string;
          name: string;
          email: string;
          is_verified: boolean;
          farm_name: string;
          specialty: string;
          location: string;
          created_at: string;
        }>;
        product_moderation?: Array<{
          id: number | string;
          product_name: string;
          price: number | string;
          stock: number;
          status: string;
          category: string;
          farmer_name: string;
          created_at: string;
        }>;
        disputes?: Array<{
          id: number | string;
          order_id: number | string;
          reason: string;
          status: string;
          refund_status: string;
          buyer_name: string;
          farmer_name: string;
          amount: number | string;
          created_at: string;
        }>;
      };
    }>({
      method: 'GET',
      url: '/admin/dashboard',
    });
  }

  async verifyFarmer(farmerId: string | number, isVerified: boolean) {
    return this.request<{ message: string; farmer: any }>({
      method: 'PATCH',
      url: `/admin/farmers/${farmerId}/verify`,
      data: { is_verified: isVerified },
    });
  }

  async moderateProduct(productId: string | number, status: 'active' | 'draft' | 'deactivated') {
    return this.request<{ message: string; product: any }>({
      method: 'PATCH',
      url: `/admin/products/${productId}/moderate`,
      data: { status },
    });
  }

  async resolveDispute(disputeId: string | number, action: 'refund' | 'accept' | 'resolve' | 'reject') {
    return this.request<{ message: string; dispute: any }>({
      method: 'PATCH',
      url: `/admin/disputes/${disputeId}/resolve`,
      data: { action },
    });
  }

  async broadcastAnnouncement(message: string, targetAudience = 'all', title = 'Platform Advisory') {
    return this.request<{ message: string; delivered_count: number; announcement?: any }>({
      method: 'POST',
      url: '/admin/broadcast',
      data: { message, targetAudience, title },
    });
  }

  async getAdminMe() {
    return this.request<{
      status: string;
      admin: {
        id: number | string;
        name: string;
        email: string;
        role: string;
        account_status: string;
        admin_role: { id: number; name: string; description?: string };
        permissions: Array<{ id: number; code: string; name: string; category: string }>;
      };
    }>({
      method: 'GET',
      url: '/admin/me',
    });
  }

  async getAdminSettings() {
    return this.request<{
      settings: Record<string, any>;
      raw: Array<{ key: string; value: any; updated_by?: number; updated_at?: string }>;
    }>({
      method: 'GET',
      url: '/admin/settings',
    });
  }

  async updateAdminSettings(settings: Record<string, any>) {
    return this.request<{ message: string; settings: Record<string, any> }>({
      method: 'PUT',
      url: '/admin/settings',
      data: settings,
    });
  }

  async getSettingsHistory(limit = 50) {
    return this.request<{ history: any[] }>({
      method: 'GET',
      url: `/admin/settings/history?limit=${limit}`,
    });
  }

  async getAdminAuditLogs(params?: {
    page?: number;
    limit?: number;
    search?: string;
    action?: string;
    entity_type?: string;
    actor_id?: number | string;
    from?: string;
    to?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.search) query.append('search', params.search);
    if (params?.action) query.append('action', params.action);
    if (params?.entity_type) query.append('entity_type', params.entity_type);
    if (params?.actor_id) query.append('actor_id', String(params.actor_id));
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return this.request<{
      logs: Array<{
        id: string | number;
        actor_id: number | null;
        actor_name: string | null;
        actor_email: string | null;
        actor_role: string | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        before_state: any;
        after_state: any;
        reason: string | null;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: `/admin/audit-logs${qs ? `?${qs}` : ''}`,
    });
  }

  async getAdminTeam() {
    return this.request<{ team: any[] }>({
      method: 'GET',
      url: '/admin/team',
    });
  }

  async getAdminRoles() {
    return this.request<{ roles: any[] }>({
      method: 'GET',
      url: '/admin/team/roles',
    });
  }

  async updateAdminRole(userId: string | number, adminRoleId: number) {
    return this.request<{ message: string; user: any }>({
      method: 'PATCH',
      url: `/admin/team/${userId}/role`,
      data: { admin_role_id: adminRoleId },
    });
  }

  async getFleetShipments(params?: {
    status?: string;
    carrier?: string;
    temp_status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      shipments: any[];
      metrics?: {
        total_shipments: number;
        active_trucks: number;
        optimal_count: number;
        elevated_count: number;
        breached_count: number;
        avg_speed_kmh: number;
        cold_chain_compliance_pct: number;
        active_cargo_weight_kg: number;
      };
      pagination?: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/logistics/fleet',
      params,
    });
  }

  async getShipmentDossier(id: string) {
    return this.request<{ shipment: any }>({
      method: 'GET',
      url: `/admin/logistics/fleet/${id}`,
    });
  }

  async assignDispatchBatch(data: any) {
    return this.request<{ message: string; shipment: any }>({
      method: 'POST',
      url: '/admin/logistics/assign',
      data,
    });
  }

  async emergencyRerouteTruck(id: string, data: { diversion_hub?: string; admin_notes?: string }) {
    return this.request<{ message: string; shipment: any }>({
      method: 'PATCH',
      url: `/admin/logistics/${id}/reroute`,
      data,
    });
  }

  // --- Phase 3: Carriers, Hubs, and Incidents ---

  async getAdminCarriers(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      carriers: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/logistics/carriers',
      params,
    });
  }

  async createAdminCarrier(data: {
    name: string;
    code: string;
    contact_person?: string;
    phone: string;
    email?: string;
    status?: string;
    total_fleet_count?: number;
    cold_chain_sla_score?: number;
    coverage_regions?: string[];
    notes?: string;
  }) {
    return this.request<{ message: string; carrier: any }>({
      method: 'POST',
      url: '/admin/logistics/carriers',
      data,
    });
  }

  async updateAdminCarrier(id: string | number, data: any) {
    return this.request<{ message: string; carrier: any }>({
      method: 'PATCH',
      url: `/admin/logistics/carriers/${id}`,
      data,
    });
  }

  async getAdminHubs(params?: { region?: string; hub_type?: string; search?: string }) {
    return this.request<{ hubs: any[] }>({
      method: 'GET',
      url: '/admin/logistics/hubs',
      params,
    });
  }

  async upsertAdminHub(data: any) {
    return this.request<{ message: string; hub: any }>({
      method: 'POST',
      url: '/admin/logistics/hubs',
      data,
    });
  }

  async getAdminIncidents(params?: {
    severity?: string;
    resolved?: string | boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      incidents: any[];
      metrics: {
        total_incidents: number;
        unresolved_count: number;
        critical_unresolved: number;
        temperature_breaches: number;
        route_deviations: number;
        mechanical_failures: number;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/logistics/incidents',
      params,
    });
  }

  async resolveAdminIncident(id: string | number, data: { resolution_notes: string; corrective_action?: string }) {
    return this.request<{ message: string; incident: any }>({
      method: 'POST',
      url: `/admin/logistics/incidents/${id}/resolve`,
      data,
    });
  }

  // ==========================================
  // Phase 4: Support Tickets & Inquiries
  // ==========================================

  async getAdminTickets(params?: {
    status?: string;
    priority?: string;
    category?: string;
    assigned_to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      tickets: any[];
      metrics: {
        total_tickets: number;
        open_tickets: number;
        in_progress_tickets: number;
        urgent_tickets: number;
        waiting_customer: number;
        resolved_today: number;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/tickets',
      params,
    });
  }

  async getAdminTicketDossier(id: string | number) {
    return this.request<{
      ticket: any;
      messages: any[];
    }>({
      method: 'GET',
      url: `/admin/tickets/${id}`,
    });
  }

  async createAdminTicket(data: {
    user_id?: number | string;
    subject: string;
    category?: string;
    priority?: string;
    initial_message?: string;
    assigned_to?: number | string;
    order_id?: number | string;
    shipment_id?: string;
  }) {
    return this.request<{ message: string; ticket: any }>({
      method: 'POST',
      url: '/admin/tickets',
      data,
    });
  }

  async updateAdminTicket(id: string | number, data: {
    status?: string;
    priority?: string;
    category?: string;
    assigned_to?: number | string | null;
  }) {
    return this.request<{ message: string; ticket: any }>({
      method: 'PATCH',
      url: `/admin/tickets/${id}`,
      data,
    });
  }

  async addAdminTicketMessage(ticketId: string | number, data: {
    message: string;
    is_internal?: boolean;
    attachments?: any[];
  }) {
    return this.request<{ message: string; ticket_message: any }>({
      method: 'POST',
      url: `/admin/tickets/${ticketId}/messages`,
      data,
    });
  }

  async assignAdminTicket(ticketId: string | number, assignedTo: number | string) {
    return this.request<{ message: string; ticket: any }>({
      method: 'POST',
      url: `/admin/tickets/${ticketId}/assign`,
      data: { assigned_to: assignedTo },
    });
  }

  async escalateAdminTicket(ticketId: string | number, reason?: string) {
    return this.request<{ message: string; ticket: any }>({
      method: 'POST',
      url: `/admin/tickets/${ticketId}/escalate`,
      data: { reason },
    });
  }

  // ==========================================
  // Phase 4: Announcements & Broadcast Communications
  // ==========================================

  async getAdminAnnouncements(params?: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      announcements: any[];
      metrics: {
        total_broadcasts: number;
        sent_count: number;
        scheduled_count: number;
        draft_count: number;
        total_recipients_reached: number;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/announcements',
      params,
    });
  }

  async getAdminAnnouncementDossier(id: string | number) {
    return this.request<{
      announcement: any;
      deliveries: any[];
    }>({
      method: 'GET',
      url: `/admin/announcements/${id}`,
    });
  }

  async estimateAdminAudience(data: {
    target_audience: string;
    target_filter?: {
      role?: string;
      region?: string;
      kyc_tier?: string;
    };
  }) {
    return this.request<{ estimated_reach: number }>({
      method: 'POST',
      url: '/admin/announcements/estimate',
      data,
    });
  }

  async createAdminAnnouncement(data: {
    title: string;
    message: string;
    target_audience: string;
    target_filter?: any;
    priority?: string;
    category?: string;
    channels?: string[];
    scheduled_at?: string | null;
    expires_at?: string | null;
    is_dismissible?: boolean;
    status?: string;
  }) {
    return this.request<{ message: string; announcement: any }>({
      method: 'POST',
      url: '/admin/announcements',
      data,
    });
  }

  async updateAdminAnnouncement(id: string | number, data: any) {
    return this.request<{ message: string; announcement: any }>({
      method: 'PATCH',
      url: `/admin/announcements/${id}`,
      data,
    });
  }

  async sendAdminAnnouncement(id: string | number) {
    return this.request<{
      message: string;
      announcement: any;
      delivered_count: number;
    }>({
      method: 'POST',
      url: `/admin/announcements/${id}/send`,
    });
  }

  async cancelAdminAnnouncement(id: string | number) {
    return this.request<{ message: string; announcement: any }>({
      method: 'POST',
      url: `/admin/announcements/${id}/cancel`,
    });
  }

  // ==========================================
  // Phase 4: Notification Templates
  // ==========================================

  async getAdminNotificationTemplates() {
    return this.request<{ templates: any[] }>({
      method: 'GET',
      url: '/admin/notification-templates',
    });
  }

  async createAdminNotificationTemplate(data: {
    title: string;
    code: string;
    channel?: string;
    subject?: string;
    body: string;
    variables?: string[];
  }) {
    return this.request<{ message: string; template: any }>({
      method: 'POST',
      url: '/admin/notification-templates',
      data,
    });
  }

  async updateAdminNotificationTemplate(id: string | number, data: any) {
    return this.request<{ message: string; template: any }>({
      method: 'PATCH',
      url: `/admin/notification-templates/${id}`,
      data,
    });
  }

  async deleteAdminNotificationTemplate(id: string | number) {
    return this.request<{ message: string }>({
      method: 'DELETE',
      url: `/admin/notification-templates/${id}`,
    });
  }

  // ==========================================
  // Phase 5: Risk & Fraud Governance
  // ==========================================

  async getAdminRiskRules() {
    return this.request<{ rules: any[] }>({
      method: 'GET',
      url: '/admin/risk/rules',
    });
  }

  async createAdminRiskRule(data: {
    name: string;
    rule_type: string;
    description?: string;
    severity?: string;
    threshold_config?: any;
    action?: string;
  }) {
    return this.request<{ message: string; rule: any }>({
      method: 'POST',
      url: '/admin/risk/rules',
      data,
    });
  }

  async updateAdminRiskRule(id: string | number, data: any) {
    return this.request<{ message: string; rule: any }>({
      method: 'PATCH',
      url: `/admin/risk/rules/${id}`,
      data,
    });
  }

  async getAdminRiskFlags(params?: {
    status?: string;
    severity?: string;
    entity_type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      flags: any[];
      metrics: {
        total_flags: number;
        open_flags: number;
        critical_flags: number;
        under_investigation: number;
        resolved_safe: number;
        confirmed_fraud: number;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/risk/flags',
      params,
    });
  }

  async resolveAdminRiskFlag(id: string | number, data: { status: string; resolution_notes: string }) {
    return this.request<{ message: string; flag: any }>({
      method: 'PATCH',
      url: `/admin/risk/flags/${id}`,
      data,
    });
  }

  // ==========================================
  // Phase 5: Reports & Data Exports
  // ==========================================

  async getAdminReports(params?: { page?: number; limit?: number }) {
    return this.request<{
      jobs: any[];
      catalog: Array<{
        type: string;
        name: string;
        description: string;
        category: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/reports',
      params,
    });
  }

  async getAdminReportJobById(id: string | number) {
    return this.request<{ job: any }>({
      method: 'GET',
      url: `/admin/reports/jobs/${id}`,
    });
  }

  async exportAdminReport(data: {
    report_type: string;
    name?: string;
    parameters?: any;
    format?: string;
  }) {
    return this.request<{
      message: string;
      job: any;
      csv: string;
      row_count: number;
    }>({
      method: 'POST',
      url: '/admin/reports/export',
      data,
    });
  }

  async exportReport(data: {
    report_type: string;
    name?: string;
    parameters?: any;
    format?: string;
  }) {
    return this.exportAdminReport(data);
  }

  async getAdminReportSchedules() {
    return this.request<{ schedules: any[] }>({
      method: 'GET',
      url: '/admin/reports/schedules',
    });
  }

  async createAdminReportSchedule(data: {
    report_type: string;
    name: string;
    cadence?: string;
    recipients?: string[];
    parameters?: any;
  }) {
    return this.request<{ message: string; schedule: any }>({
      method: 'POST',
      url: '/admin/reports/schedules',
      data,
    });
  }

  async updateAdminReportSchedule(id: string | number, data: any) {
    return this.request<{ message: string; schedule: any }>({
      method: 'PATCH',
      url: `/admin/reports/schedules/${id}`,
      data,
    });
  }

  async deleteAdminReportSchedule(id: string | number) {
    return this.request<{ message: string }>({
      method: 'DELETE',
      url: `/admin/reports/schedules/${id}`,
    });
  }

  // ==========================================
  // Phase 5: System Health & Diagnostics
  // ==========================================

  async getAdminSystemHealth() {
    return this.request<{
      status: string;
      timestamp: string;
      uptime_seconds: number;
      node_version: string;
      environment: string;
      database: {
        status: string;
        latency_ms: number;
        pool_total_count: number;
        pool_idle_count: number;
        pool_waiting_count: number;
      };
      system_memory: {
        heap_used_mb: number;
        heap_total_mb: number;
        rss_mb: number;
      };
      queues: {
        unverified_kyc: number;
        pending_products: number;
        active_breaches: number;
        open_tickets: number;
        active_disputes: number;
        unreconciled_payments: number;
      };
      telemetry: {
        failed_webhooks_count: number;
        failed_deliveries_count: number;
        audit_events_24h: number;
      };
      recent_jobs: any[];
      recent_events: any[];
    }>({
      method: 'GET',
      url: '/admin/system/health',
    });
  }

  async getAdminSystemEvents(params?: {
    event_type?: string;
    severity?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      events: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/system/events',
      params,
    });
  }

  async getAdminAnalytics() {
    return this.request<{ analytics: any[] }>({
      method: 'GET',
      url: '/admin/analytics',
    });
  }

  async updateUserStatus(id: string | number, status: 'active' | 'suspended') {
    return this.request<{ message: string; user: any }>({
      method: 'PATCH',
      url: `/admin/users/${id}/status`,
      data: { status },
    });
  }

  // Phase 1: KYC Methods
  async getKycQueue(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    tier?: string;
    region?: string;
  }) {
    return this.request<{
      farmers: any[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      counts: {
        pending: string | number;
        under_review: string | number;
        field_visit: string | number;
        approved: string | number;
        rejected: string | number;
        changes_requested: string | number;
        all_count: string | number;
      };
    }>({
      method: 'GET',
      url: '/admin/kyc',
      params,
    });
  }

  async getKycDossier(id: string | number) {
    return this.request<{
      farmer: any;
      documents: any[];
      fieldVisits: any[];
      reviews: any[];
      riskFlags?: any[];
    }>({
      method: 'GET',
      url: `/admin/kyc/${id}`,
    });
  }

  async getKycIntelligence(id: string | number) {
    return this.request<{
      farmer_id: number;
      name: string;
      ocr_data: Record<string, any>;
      ocr_raw_text: string | null;
      ocr_confidence: number;
      id_hash: string | null;
      duplicate_detection: any;
      risk_flags: any[];
    }>({
      method: 'GET',
      url: `/admin/kyc/${id}/intelligence`,
    });
  }

  async addKycDocument(id: string | number, data: FormData) {
    return this.client.post<{ message: string; document: any }>(
      `/admin/kyc/${id}/documents`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }

  async deleteKycDocument(id: string | number, documentId: string | number) {
    return this.request<{ message: string; document: any }>({
      method: 'DELETE',
      url: `/admin/kyc/${id}/documents/${documentId}`,
    });
  }

  async addFieldVisit(id: string | number, data: {
    findings: string;
    visit_date?: string;
    gps_coordinates?: string;
    verified_crops?: string[];
    recommendation?: string;
  }) {
    return this.request<{ message: string; visit: any }>({
      method: 'POST',
      url: `/admin/kyc/${id}/field-visits`,
      data,
    });
  }

  async reviewKyc(id: string | number, data: {
    decision: 'approve' | 'reject' | 'request_info' | 'under_review';
    tier?: string;
    reason?: string;
    notes?: string;
  }) {
    return this.request<{ message: string; result: any }>({
      method: 'POST',
      url: `/admin/kyc/${id}/review`,
      data,
    });
  }

  async getKycHistory(id: string | number) {
    return this.request<{ history: any[] }>({
      method: 'GET',
      url: `/admin/kyc/${id}/history`,
    });
  }

  // Phase 1: User 360 Methods
  async getUser360(id: string | number) {
    return this.request<{
      user: any;
      roleProfile: any;
      kyc: { status: string; tier: string; documents: any[] };
      products: { total: number; active: number; total_value: number; recent: any[] };
      orders: { total: number; total_spent_or_earned: number; recent: any[] };
      disputes: any[];
      auditLogs: any[];
    }>({
      method: 'GET',
      url: `/admin/users/${id}`,
    });
  }

  async performUserAction(id: string | number, data: { action: string; payload?: any }) {
    return this.request<{ message: string; [key: string]: any }>({
      method: 'POST',
      url: `/admin/users/${id}/action`,
      data,
    });
  }

  // Phase 1: Product Moderation & Governance Methods
  async getProductsAdmin(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    moderation_status?: string;
    category?: string;
    farmer?: string;
    min_price?: number;
    max_price?: number;
  }) {
    return this.request<{
      products: any[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      counts: {
        pending: string | number;
        approved: string | number;
        rejected: string | number;
        changes_requested: string | number;
        all_count: string | number;
      };
    }>({
      method: 'GET',
      url: '/admin/products',
      params,
    });
  }

  async getProductDossier(id: string | number) {
    return this.request<{
      product: any;
      moderationActions: any[];
      reviews: any[];
      benchmarkCorridor: any;
    }>({
      method: 'GET',
      url: `/admin/products/${id}`,
    });
  }

  async moderateProductAdmin(id: string | number, data: {
    action: 'approve' | 'reject' | 'request_changes' | 'deactivate';
    reason?: string;
    notes?: string;
    grade?: string;
    cold_chain_required?: boolean;
  }) {
    return this.request<{ message: string; result: any }>({
      method: 'PATCH',
      url: `/admin/products/${id}/moderate`,
      data,
    });
  }

  async bulkModerateProducts(data: {
    product_ids: (string | number)[];
    action: 'approve' | 'reject' | 'deactivate';
    reason?: string;
    notes?: string;
  }) {
    return this.request<{ success: boolean; modifiedCount: number; action: string }>({
      method: 'POST',
      url: '/admin/products/bulk-moderate',
      data,
    });
  }

  async getProductModerationHistory(id: string | number) {
    return this.request<{ history: any[] }>({
      method: 'GET',
      url: `/admin/products/${id}/history`,
    });
  }

  // Categories Governance
  async getCategoriesAdmin() {
    return this.request<{ categories: any[] }>({
      method: 'GET',
      url: '/admin/categories',
    });
  }

  async createCategoryAdmin(data: {
    name: string;
    description?: string;
    icon?: string;
    attributes?: any[];
  }) {
    return this.request<{ message: string; category: any }>({
      method: 'POST',
      url: '/admin/categories',
      data,
    });
  }

  async updateCategoryAdmin(id: string | number, data: {
    name?: string;
    description?: string;
    icon?: string;
    is_active?: boolean;
    attributes?: any[];
  }) {
    return this.request<{ message: string; category: any }>({
      method: 'PUT',
      url: `/admin/categories/${id}`,
      data,
    });
  }

  async deleteCategoryAdmin(id: string | number) {
    return this.request<{ message: string; result: any }>({
      method: 'DELETE',
      url: `/admin/categories/${id}`,
    });
  }

  // Reviews Moderation
  async getReviewsAdmin(params?: {
    page?: number;
    limit?: number;
    search?: string;
    is_hidden?: boolean | string;
    rating?: number | string;
  }) {
    return this.request<{
      reviews: any[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>({
      method: 'GET',
      url: '/admin/reviews',
      params,
    });
  }

  async moderateReviewAdmin(id: string | number, data: { is_hidden: boolean; reason?: string }) {
    return this.request<{ message: string; review: any }>({
      method: 'PATCH',
      url: `/admin/reviews/${id}`,
      data,
    });
  }

  // Campaigns Governance
  async getCampaignsAdmin(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    return this.request<{
      campaigns: any[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>({
      method: 'GET',
      url: '/admin/campaigns',
      params,
    });
  }

  async moderateCampaignAdmin(id: string | number, data: {
    action: 'approve' | 'reject' | 'pause';
    reason?: string;
    budget_cap?: number;
  }) {
    return this.request<{ message: string; campaign: any }>({
      method: 'PATCH',
      url: `/admin/campaigns/${id}`,
      data,
    });
  }

  // Price Corridors & Outliers
  async getPriceCorridors(params?: { region?: string; commodity?: string }) {
    return this.request<{ corridors: any[] }>({
      method: 'GET',
      url: '/admin/pricing/corridors',
      params,
    });
  }

  async upsertPriceCorridor(data: {
    commodity_name: string;
    region: string;
    min_price: number;
    max_price: number;
    target_price: number;
    unit?: string;
    deviation_threshold_pct?: number;
  }) {
    return this.request<{ message: string; corridor: any }>({
      method: 'POST',
      url: '/admin/pricing/corridors',
      data,
    });
  }

  async getPriceOutliers() {
    return this.request<{ outliers: any[] }>({
      method: 'GET',
      url: '/admin/pricing/outliers',
    });
  }

  async evaluateProductPricing(id: string | number) {
    return this.request<{
      status: string;
      message: string;
      product: any;
      corridor: any;
      deviation_pct?: string;
    }>({
      method: 'POST',
      url: `/admin/pricing/evaluate/${id}`,
    });
  }

  // --- Phase 2: Commerce, Payments, Escrow, Disputes API ---

  async getAdminOrders(params?: {
    status?: string;
    payment_status?: string;
    delivery_status?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      orders: any[];
      metrics: {
        total_orders: number;
        pending_count: number;
        confirmed_count: number;
        in_transit_count: number;
        delivered_count: number;
        cancelled_count: number;
        refunded_count: number;
        total_gmv: number | string;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/orders',
      params,
    });
  }

  async getAdminOrderById(orderId: string | number) {
    return this.request<{ order: any }>({
      method: 'GET',
      url: `/admin/orders/${orderId}`,
    });
  }

  async updateAdminOrderStatus(orderId: string | number, data: { status: string; reason: string }) {
    return this.request<{ message: string; order: any }>({
      method: 'PATCH',
      url: `/admin/orders/${orderId}/status`,
      data,
    });
  }

  async refundAdminOrder(
    orderId: string | number,
    data: { amount?: number; reason: string; idempotencyKey?: string; refundFull?: boolean }
  ) {
    return this.request<{
      message: string;
      result: {
        success: boolean;
        order: any;
        refundAmount: number;
        totalRefunded: number;
        isFullRefund: boolean;
      };
    }>({
      method: 'POST',
      url: `/admin/orders/${orderId}/refund`,
      data,
    });
  }

  async getAdminPayments(params?: {
    status?: string;
    method?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      payments: any[];
      metrics: {
        total_payments: number;
        completed_count: number;
        pending_count: number;
        refunded_count: number;
        unreconciled_count: number;
        total_settled_volume: number | string;
        telebirr_volume: number | string;
        chapa_volume: number | string;
        total_refunded_volume: number | string;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/payments',
      params,
    });
  }

  async getAdminPaymentById(paymentId: string | number) {
    return this.request<{ payment: any }>({
      method: 'GET',
      url: `/admin/payments/${paymentId}`,
    });
  }

  async reconcileAdminPayment(paymentId: string | number, data: { status?: string; notes?: string }) {
    return this.request<{ message: string; payment: any }>({
      method: 'POST',
      url: `/admin/payments/${paymentId}/reconcile`,
      data,
    });
  }

  async getAdminActiveEscrow(params?: {
    release_status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      ledger: any[];
      metrics: {
        total_records: number;
        held_count: number;
        cleared_count: number;
        disputed_count: number;
        refunded_count: number;
        total_held_amount: number | string;
        total_cleared_payout: number | string;
        total_platform_fees: number | string;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/escrow/active',
      params,
    });
  }

  async releaseAdminEscrow(
    escrowId: string | number,
    data: { notes?: string; makerCheckerApproved?: boolean }
  ) {
    return this.request<{ message: string; escrow: any }>({
      method: 'POST',
      url: `/admin/escrow/${escrowId}/release`,
      data,
    });
  }

  async holdAdminEscrow(
    escrowId: string | number,
    data: { reason: string; holdDays?: number }
  ) {
    return this.request<{ message: string; escrow: any }>({
      method: 'POST',
      url: `/admin/escrow/${escrowId}/hold`,
      data,
    });
  }

  async getAdminDisputes(params?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      disputes: any[];
      metrics: {
        total_disputes: number;
        open_count: number;
        accepted_count: number;
        rejected_count: number;
        transit_spoilage_count: number;
        weight_shortage_count: number;
        grade_mismatch_count: number;
        non_delivery_count: number;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/disputes',
      params,
    });
  }

  async getAdminDisputeById(disputeId: string | number) {
    return this.request<{ dispute: any }>({
      method: 'GET',
      url: `/admin/disputes/${disputeId}`,
    });
  }

  async settleAdminDisputeSplit(
    disputeId: string | number,
    data: {
      buyer_refund: number;
      farmer_payout: number;
      platform_fee?: number;
      admin_notes?: string;
    }
  ) {
    return this.request<{
      message: string;
      settlement: any;
      dispute: any;
    }>({
      method: 'POST',
      url: `/admin/disputes/${disputeId}/settle`,
      data,
    });
  }

  async getAdminReturns(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      returns: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>({
      method: 'GET',
      url: '/admin/returns',
      params,
    });
  }

  async updateAdminReturnStatus(
    returnId: string | number,
    data: { status: string; restock_quantity?: number; notes?: string }
  ) {
    return this.request<{ message: string; return_record: any }>({
      method: 'PATCH',
      url: `/admin/returns/${returnId}/status`,
      data,
    });
  }

  async listUsers(params?: any) {
    return this.request<{ users: any[] }>({
      method: 'GET',
      url: '/users',
      params,
    });
  }

  async assignDelivery(orderId: number | string, deliveryPartnerId: number | string) {
    return this.request<{ message: string }>({
      method: 'POST',
      url: '/delivery/assign',
      data: { order_id: orderId, delivery_partner_id: deliveryPartnerId },
    });
  }

  // Image upload (Cloudinary via backend)
  async uploadImage(file: File) {
    const body = new FormData();
    body.append('image', file);
    const response = await this.client.post<{ url: string; public_id: string }>(
      '/upload/product-image',
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  }

  async deleteImage(publicId: string) {
    return this.request<{ message: string }>({
      method: 'DELETE',
      url: '/upload/product-image',
      data: { public_id: publicId },
    });
  }
}

// Export singleton instance
export const api = new APIClient();
export default api;
