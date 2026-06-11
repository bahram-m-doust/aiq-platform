import type { CityModelDistrict } from "@/features/app/city-model";
import type { ReviewComment } from "@/features/review-comments/types";

export type CityModelDeliverableStatus =
  | "PENDING_UPLOAD"
  | "CLIENT_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED";

export type CityModelDeliverableRow = {
  id: string;
  brand_id: string;
  district_key: string;
  file_id: string | null;
  status: string;
  uploaded_at: string | null;
  approved_at: string | null;
};

export type CityModelDistrictWorkspace = {
  district: CityModelDistrict;
  brandId: string;
  status: CityModelDeliverableStatus;
  signedUrl: string | null;
  downloadUrl: string | null;
  fileName: string | null;
  markdown: string | null;
  comments: ReviewComment[];
  canReview: boolean;
  uploadedAt: string | null;
  approvedAt: string | null;
};

export type CityModelAdminDistrict = {
  district: CityModelDistrict;
  status: CityModelDeliverableStatus;
  fileName: string | null;
};

export type CityModelUploadState = {
  status: "idle" | "success" | "error";
  message: string;
};
