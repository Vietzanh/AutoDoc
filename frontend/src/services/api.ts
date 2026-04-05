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

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: BASE_URL });
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
    const res = await this.client.get(`/documents/${docId}/download`, {
      responseType: "blob",
    });
    return res.data;
  }

  async getDocumentThumbnails(docId: number): Promise<{ page_number: number; image_base64: string }[]> {
    const res = await this.client.get<{ thumbnails: { page_number: number; image_base64: string }[] }>(
      `/documents/${docId}/thumbnails`
    );
    return res.data.thumbnails;
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────

  async createReconstructJob(
    documentId: number,
    maxImageWidth = 6.0,
    renderDpi = 300
  ): Promise<Job> {
    const res = await this.client.post<Job>("/jobs/reconstruct", {
      document_id: documentId,
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
    pages: Array<{ original_index: number; rotation: number; deleted: boolean }>,
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

  async downloadJobResult(jobId: number): Promise<Blob> {
    const res = await this.client.get(`/jobs/${jobId}/download`, {
      responseType: "blob",
    });
    return res.data;
  }
}

export const api = new ApiClient();
