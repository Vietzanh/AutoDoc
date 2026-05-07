/**
 * API client — thin wrapper around axios that injects the auth token
 * and returns typed responses.
 */

import axios, { AxiosInstance } from "axios";

const BASE_URL = "/api";

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Document {
  id: number;
  user_id: number;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  page_count: number | null;
  created_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface Job {
  id: number;
  user_id: number;
  document_id: number | null;
  tool: string;
  status: JobStatus;
  input_document_ids: string;
  output_filename: string | null;
  output_path: string | null;
  error_message: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
}

export type PageNumberPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type PageNumberFormat = "number-only" | "page-n" | "page-n-of-p" | "custom";
export type PageNumberMode = "single" | "facing";

export interface PageNumberParams {
  document_id: number;
  mode: PageNumberMode;
  position: PageNumberPosition;
  start_number: number;
  from_page: number;
  to_page: number;
  format: PageNumberFormat;
  custom_text?: string;
  text_style: {
    font_name: string;
    font_size: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    color: string;
  };
  output_filename: string;
}

export interface CropParams {
  document_id: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  from_page: number;
  to_page: number;
  output_filename: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 60000,
      withCredentials: false,
    });
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    // On 401, clear token and redirect to login
    this.client.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }
        return Promise.reject(err);
      }
    );
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  async register(email: string, username: string, password: string): Promise<User> {
    const res = await this.client.post<User>("/auth/register", {
      email,
      username,
      password,
    });
    return res.data;
  }

  async login(username: string, password: string): Promise<Token> {
    // OAuth2 password flow needs form-encoded body
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);
    const res = await this.client.post<Token>("/auth/login", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.data;
  }

  async getMe(): Promise<User> {
    const res = await this.client.get<User>("/auth/me");
    return res.data;
  }

  // ── Documents ───────────────────────────────────────────────────────────────

  async uploadDocument(file: File): Promise<Document> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await this.client.post<Document>("/documents", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }

  async listDocuments(offset = 0, limit = 20): Promise<DocumentListResponse> {
    const res = await this.client.get<DocumentListResponse>("/documents", {
      params: { offset, limit },
    });
    return res.data;
  }

  async deleteDocument(docId: number): Promise<void> {
    await this.client.delete(`/documents/${docId}`);
  }

  async downloadDocument(docId: number): Promise<Blob> {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`/api/documents/${docId}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    return res.blob();
  }

  async getDocumentThumbnails(docId: number, width: number = 200): Promise<{ page_number: number; image_base64: string; width_pts: number; height_pts: number }[]> {
    const res = await this.client.get<{ thumbnails: { page_number: number; image_base64: string; width_pts: number; height_pts: number }[] }>(
      `/documents/${docId}/thumbnails`, { params: { width } }
    );
    return res.data.thumbnails;
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────

  async createReconstructJob(
    documentId: number,
    outputFilename = "",
    maxImageWidth = 6.0,
    renderDpi = 300
  ): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/reconstruct", {
      document_id: documentId,
      output_filename: outputFilename,
      max_image_width: maxImageWidth,
      render_dpi: renderDpi,
    });
    return res.data;
  }

  async createCombineJob(
    documentIds: number[],
    outputFilename = "combined.pdf"
  ): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/combine", {
      document_ids: documentIds,
      output_filename: outputFilename,
    });
    return res.data;
  }

  async createSplitJob(
    documentId: number,
    splitPoints: number[],
    outputFilename = "split_part"
  ): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/split", {
      document_id: documentId,
      split_points: splitPoints,
      output_filename: outputFilename,
    });
    return res.data;
  }

  async getSplitParts(jobId: number): Promise<{ filename: string; pages: string }[]> {
    const res = await this.client.get<{ parts: { filename: string; pages: string }[] }>(
      `/jobs/${jobId}/parts`
    );
    return res.data.parts;
  }

  async createOrganizeJob(
    documentId: number,
    pages: Array<{ original_index: number; source_document_id: number; rotation: number; deleted: boolean }>,
    outputFilename = "organized.pdf"
  ): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/organize", {
      document_id: documentId,
      pages,
      output_filename: outputFilename,
    });
    return res.data;
  }

  async createExtractJob(
    documentId: number,
    pages: Array<{ original_index: number; rotation: number; deleted: boolean }>,
    outputFilename = "extracted.pdf"
  ): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/extract", {
      document_id: documentId,
      pages,
      output_filename: outputFilename,
    });
    return res.data;
  }

  async createReorderJob(
    documentId: number,
    newOrder: number[],
    outputFilename = "reordered.pdf"
  ): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/reorder", {
      document_id: documentId,
      new_order: newOrder,
      output_filename: outputFilename,
    });
    return res.data;
  }

  async createPageNumbersJob(params: PageNumberParams): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/page-numbers", params);
    return res.data;
  }

  async createCropJob(params: CropParams): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/crop", params);
    return res.data;
  }

  async getJob(jobId: number): Promise<Job> {
    const res = await this.client.get<Job>(`/jobs/${jobId}`);
    return res.data;
  }

  async listJobs(status?: JobStatus, offset = 0, limit = 20): Promise<JobListResponse> {
    const res = await this.client.get<JobListResponse>("/jobs", {
      params: { status, offset, limit },
    });
    return res.data;
  }

  async deleteJob(jobId: number): Promise<void> {
    await this.client.delete(`/jobs/${jobId}`);
  }

  /**
   * Download a job result as a Blob.
   * Uses native fetch to avoid Vite proxy truncating large binary responses.
   */
  async downloadJobResult(jobId: number): Promise<Blob> {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`/api/jobs/${jobId}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    return res.blob();
  }
}

export const api = new ApiClient();
