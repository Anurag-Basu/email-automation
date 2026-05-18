export type LeadStatus = "pending" | "sent" | "failed";

export type LeadCategory = "frontend" | "fullstack" | "other";

export type Lead = {
  id: number;
  author: string;
  email: string;
  description: string;
  category: LeadCategory;
  status: LeadStatus;
  lastError?: string;
};

export type LeadsFile = {
  leads: Lead[];
  nextId: number;
};
