const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async postForm(endpoint: string, formData: FormData) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: getHeaders(),
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Unknown error occurred" }));
      throw new Error(err.detail || "Request failed");
    }
    return response.json();
  },

  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Unknown error occurred" }));
      throw new Error(err.detail || "Request failed");
    }
    return response.json();
  },

  async get(endpoint: string) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || "Request failed");
    }
    return response.json();
  },

  async delete(endpoint: string) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || "Request failed");
    }
    return response.json();
  },

  async put(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || "Request failed");
    }
    return response.json();
  },

  async download(endpoint: string) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Download failed" }));
      throw new Error(err.detail || "Download failed");
    }
    return response.blob();
  },

  async postBlob(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(err.detail || "Request failed");
    }
    return response.blob();
  },

  async generateJobInsights(id: number) {
    return this.post(`/tracker/${id}/generate-insights`, {});
  },

  async estimateSalary(id: number) {
    return this.post(`/tracker/${id}/estimate-salary`, {});
  },

  async generateBragSheet(id: number) {
    return this.post(`/tracker/${id}/generate-brag-sheet`, {});
  },
};
